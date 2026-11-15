import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { extractText, getDocumentProxy } from 'unpdf';
import { createServer as createViteServer } from 'vite';
import {
  type DataStore,
  type ReportRecord,
  type SessionRecord,
  type TurnRecord,
  type UserRecord,
  createDataStore,
} from './db/store.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const VALID_LEVELS = new Set(['Intern', 'Junior', 'Mid', 'Senior']);
const VALID_TYPES = new Set(['HR', 'Technical', 'Behavioral', 'Mixed']);
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_CHARS = 12000;

let store: DataStore;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function getAuthSecret(): string {
  return (process.env.AUTH_SECRET || '').trim() || 'dev-interview-simulator-secret-change-me';
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createAuthToken(userId: string): string {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

function verifyAuthToken(token: string): string | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, providedSig] = token.split('.', 2);
  const expectedSig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('hex');
  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

function formatUser(row: UserRecord) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    created_at: row.created_at,
  };
}

interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const userId = verifyAuthToken(token);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    const user = await store.findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'User account not found. Please sign in again.' });
      return;
    }
    req.authUser = user;
    next();
  } catch (err) {
    res.status(500).json({ error: `Authentication check failed: ${(err as Error).message}` });
  }
}

const INTERVIEWER_SYSTEM_PROMPT = `You are a friendly, clear, and fair job interviewer.
Your style is simple, direct, and easy to understand:
- Ask one short, plain-English question at a time tailored to the candidate's target role, experience level, interview type, resume, and job description.
- Keep questions concise (1 clear sentence, no jargon or multi-part walls of text).
- Do NOT include long welcome speeches or introductions like "Welcome! I'll be conducting your interview today." Jump straight into the question.
- Listen carefully to each answer. If an answer is very short or unclear, ask ONE simple follow-up question. Otherwise give a brief 3–6 word acknowledgement and ask the next question.
- Never reveal internal rubrics or break character during the interview.
- Always respond strictly with valid JSON matching the requested schema, with no markdown fences or extra commentary outside the JSON object.`;

function getConfiguredGeminiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'your-gemini-api-key') {
    return '';
  }
  return key;
}

function getConfiguredAnthropicKey(): string {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key || key === 'your-anthropic-api-key') {
    return '';
  }
  return key;
}

function isDemoModeEnabled(): boolean {
  const forceDemo = (process.env.DEMO_MODE || 'false').trim().toLowerCase() === 'true';
  return forceDemo || (!getConfiguredGeminiKey() && !getConfiguredAnthropicKey());
}

function getActiveAiProvider(): 'gemini' | 'anthropic' | 'demo' {
  if (isDemoModeEnabled()) return 'demo';
  if (getConfiguredGeminiKey()) return 'gemini';
  if (getConfiguredAnthropicKey()) return 'anthropic';
  return 'demo';
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback regex extraction below
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Model response did not contain a valid JSON object.');
  }
  const parsed = JSON.parse(match[0]);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Parsed JSON payload was not an object.');
  }
  return parsed as Record<string, unknown>;
}

let cachedGeminiClient: GoogleGenAI | null = null;
let cachedGeminiApiKey = '';

function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!cachedGeminiClient || cachedGeminiApiKey !== apiKey) {
    cachedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedGeminiApiKey = apiKey;
  }
  return cachedGeminiClient;
}

async function callGeminiJson(userPrompt: string): Promise<Record<string, unknown>> {
  const apiKey = getConfiguredGeminiKey();
  const model = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
  const ai = getGeminiClient(apiKey);

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: INTERVIEWER_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  const text = (response.text ?? '').trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return extractJsonObject(text);
}

async function callAnthropicJson(userPrompt: string, maxTokens = 1400): Promise<Record<string, unknown>> {
  const apiKey = getConfiguredAnthropicKey();
  const model = (process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL).trim() || DEFAULT_ANTHROPIC_MODEL;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.4,
      system: INTERVIEWER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (payload.content || [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');

  return extractJsonObject(text);
}

async function callAiJson(userPrompt: string, maxTokens = 1400): Promise<Record<string, unknown>> {
  if (getConfiguredGeminiKey()) {
    return callGeminiJson(userPrompt);
  }
  return callAnthropicJson(userPrompt, maxTokens);
}

function demoQuestionBank(role: string, _experienceLevel: string, interviewType: string): string[] {
  const technical = [
    `Tell me about a ${role} project you worked on recently and what you built.`,
    'When something breaks in your code, how do you usually find and fix the bug?',
    'Explain a technical concept you use often in simple words.',
    'How do you keep your code clean and easy for others to read?',
    'Tell me about a tough technical problem you ran into and how you solved it.',
    'How do you test your work before sharing it with your team?',
    'Tell me about a time you had to learn a new tool or language quickly.',
    'If a page or app feels slow, what do you check first?',
    'How do you plan out the structure of a new feature before coding?',
    `What tool or technology do you enjoy using most as a ${role}, and why?`,
  ];

  const behavioral = [
    'Tell me about a time you worked with a team to finish a project.',
    'Describe a time you disagreed with a teammate. How did you work it out?',
    'Tell me about a mistake you made and what you learned from it.',
    'Describe a time plans or requirements changed suddenly. What did you do?',
    'Tell me about a time you helped a teammate who was stuck.',
    'Have you ever had to make a quick decision without having all the information?',
    'Tell me about helpful feedback you received and how you used it.',
    'Describe a time you took initiative without waiting to be asked.',
    'How do you handle having several urgent tasks at the same time?',
    'What keeps you motivated when a task gets difficult?',
  ];

  const hr = [
    `Tell me a little about yourself and why you are interested in this ${role} role.`,
    'What kind of team environment helps you do your best work?',
    'Tell me about a project or achievement you are proud of.',
    'What are your biggest strengths, and what is one skill you want to improve?',
    'How do you handle feedback when someone points out something to fix?',
    'How do you stay organized when juggling multiple deadlines?',
    `What do you hope to learn or achieve in the next year as a ${role}?`,
    'Tell me about a time you had to figure things out without clear instructions.',
    'How do you stay calm and focused under pressure?',
    'What questions would you ask a hiring manager before joining a team?',
  ];

  if (interviewType === 'Mixed') {
    return [
      hr[0],
      technical[0],
      behavioral[0],
      technical[1],
      behavioral[1],
      technical[2],
      behavioral[2],
      technical[3],
      hr[6],
      technical[4],
    ];
  }
  if (interviewType === 'Behavioral') return behavioral;
  if (interviewType === 'HR') return hr;
  return technical;
}

function demoOpeningQuestion(
  role: string,
  experienceLevel: string,
  interviewType: string,
  _resumeText: string | null,
): { greeting: string; question: string } {
  const bank = demoQuestionBank(role, experienceLevel, interviewType);
  return {
    greeting: '',
    question: bank[0],
  };
}

async function generateOpeningQuestion(
  role: string,
  experienceLevel: string,
  interviewType: string,
  totalQuestions: number,
  resumeText: string | null,
  jobDescription: string | null,
): Promise<{ greeting: string; question: string }> {
  if (isDemoModeEnabled()) {
    return demoOpeningQuestion(role, experienceLevel, interviewType, resumeText);
  }

  const contextParts = [
    `Target Role: ${role}`,
    `Experience Level: ${experienceLevel}`,
    `Interview Type: ${interviewType}`,
    `Planned Core Questions: ${totalQuestions}`,
  ];
  if (resumeText) contextParts.push(`Candidate Resume Excerpt:\n${resumeText.slice(0, 3500)}`);
  if (jobDescription) contextParts.push(`Job Description Excerpt:\n${jobDescription.slice(0, 3000)}`);

  const prompt = `Ask Question 1 of ${totalQuestions} directly in simple, clear, everyday English (1 short sentence). Do not include any welcome speech or introduction.

Context:
${contextParts.join('\n')}

Return JSON with this exact schema:
{
  "greeting": "",
  "question": "Simple, clear Question 1"
}`;

  try {
    const data = await callAiJson(prompt, 400);
    const fallback = demoOpeningQuestion(role, experienceLevel, interviewType, resumeText);
    return {
      greeting: String(data.greeting || '').trim(),
      question: String(data.question || '').trim() || fallback.question,
    };
  } catch (err) {
    console.error('[AI] generateOpeningQuestion fallback:', (err as Error).message);
    return demoOpeningQuestion(role, experienceLevel, interviewType, resumeText);
  }
}

function demoNextStep(
  role: string,
  experienceLevel: string,
  interviewType: string,
  totalQuestions: number,
  currentQuestionNumber: number,
  alreadyFollowedUp: boolean,
  turns: TurnRecord[],
): { action: 'ask_followup' | 'next_question' | 'complete'; transition: string; next_question: string } {
  const lastAnswer = (turns[turns.length - 1]?.answer_text || '').trim();
  const wordCount = lastAnswer ? lastAnswer.split(/\s+/).length : 0;

  if (!alreadyFollowedUp && wordCount < 20) {
    return {
      action: 'ask_followup',
      transition: 'Got it.',
      next_question: 'Can you give a quick example or a bit more detail about what you did?',
    };
  }

  if (currentQuestionNumber >= totalQuestions) {
    return {
      action: 'complete',
      transition: 'Thanks for your answers. Preparing your report now.',
      next_question: '',
    };
  }

  const bank = demoQuestionBank(role, experienceLevel, interviewType);
  return {
    action: 'next_question',
    transition: 'Thanks for sharing that.',
    next_question: bank[currentQuestionNumber % bank.length],
  };
}

async function processCandidateAnswer(
  role: string,
  experienceLevel: string,
  interviewType: string,
  totalQuestions: number,
  currentQuestionNumber: number,
  alreadyFollowedUp: boolean,
  turns: TurnRecord[],
  resumeText: string | null,
  jobDescription: string | null,
): Promise<{ action: 'ask_followup' | 'next_question' | 'complete'; transition: string; next_question: string }> {
  if (isDemoModeEnabled()) {
    return demoNextStep(
      role,
      experienceLevel,
      interviewType,
      totalQuestions,
      currentQuestionNumber,
      alreadyFollowedUp,
      turns,
    );
  }

  const transcript = turns
    .map(
      (t) =>
        `[Q${t.question_number}${t.is_followup ? ' Follow-up' : ''}] Interviewer: ${t.question_text}\nCandidate: ${t.answer_text || '(No answer)'}`,
    )
    .join('\n\n');

  const isLastCore = currentQuestionNumber >= totalQuestions;
  const followupRule = alreadyFollowedUp
    ? 'You already asked a follow-up on this question, so you MUST NOT ask another follow-up; either move to the next core question or complete the interview if all questions are done.'
    : "If the latest answer is very brief or vague, set action to 'ask_followup' and ask 1 short, easy-to-understand follow-up. Otherwise advance.";

  const prompt = `You are continuing an interview for a ${experienceLevel} ${role} (${interviewType} focus).
Keep your follow-up or next question short, simple, and easy to understand in plain English.
Core question progress: ${currentQuestionNumber} of ${totalQuestions}.
${followupRule}
${isLastCore ? "Note: This was the final planned core question. Unless a single simple follow-up is essential (and none was asked yet), set action to 'complete'." : ''}

Resume snippet: ${(resumeText || 'None provided').slice(0, 1500)}
Job description snippet: ${(jobDescription || 'None provided').slice(0, 1500)}

Transcript so far:
${transcript}

Return JSON with this exact schema:
{
  "action": "ask_followup" | "next_question" | "complete",
  "transition": "Short 3-6 word acknowledgement (e.g. 'Got it, thanks.')",
  "next_question": "Short, plain-English follow-up or next question (empty string if action is 'complete')"
}`;

  try {
    const data = await callAiJson(prompt, 700);
    let action = String(data.action || 'next_question').trim() as 'ask_followup' | 'next_question' | 'complete';
    if (alreadyFollowedUp && action === 'ask_followup') {
      action = isLastCore ? 'complete' : 'next_question';
    }
    if (!['ask_followup', 'next_question', 'complete'].includes(action)) {
      action = isLastCore ? 'complete' : 'next_question';
    }
    if (action === 'next_question' && isLastCore) {
      action = 'complete';
    }

    const transition = String(data.transition || '').trim() || 'Thank you for sharing that perspective.';
    const nextQuestion = String(data.next_question || '').trim();

    if (action !== 'complete' && !nextQuestion) {
      return demoNextStep(
        role,
        experienceLevel,
        interviewType,
        totalQuestions,
        currentQuestionNumber,
        alreadyFollowedUp,
        turns,
      );
    }

    return { action, transition, next_question: nextQuestion };
  } catch (err) {
    console.error('[AI] processCandidateAnswer fallback:', (err as Error).message);
    return demoNextStep(
      role,
      experienceLevel,
      interviewType,
      totalQuestions,
      currentQuestionNumber,
      alreadyFollowedUp,
      turns,
    );
  }
}

function clampScore(value: unknown, fallback = 72): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function demoFinalReport(
  role: string,
  experienceLevel: string,
  interviewType: string,
  turns: TurnRecord[],
) {
  const scores: number[] = [];
  const breakdown = turns.map((turn) => {
    const ans = (turn.answer_text || '').trim();
    const wc = ans ? ans.split(/\s+/).length : 0;
    const hasNumbers = /\d/.test(ans);
    const hasStructure = /(because|trade-off|result|impact|designed|led|measured|learned|metric)/i.test(ans);

    let qScore = 35;
    let feedback =
      'No response was recorded for this prompt. Practice delivering a concise 60-second structured response even under time pressure.';

    if (wc > 0) {
      qScore = Math.min(94, 58 + Math.min(22, Math.floor(wc / 3)) + (hasNumbers ? 7 : 0) + (hasStructure ? 7 : 0));
      feedback =
        qScore >= 80
          ? 'Strong specificity and clear cause-and-effect framing.'
          : 'Solid core idea; adding concrete metrics, constraints, and alternatives considered would elevate the answer.';
    }

    scores.push(qScore);
    return {
      question_number: turn.question_number,
      is_followup: turn.is_followup,
      question: turn.question_text,
      user_answer: ans || '(No response provided)',
      score: qScore,
      feedback,
      model_answer: `In a ${experienceLevel} ${role} scenario, start with 1–2 sentences of context and constraints, explain the two options you evaluated and why you selected your approach, describe execution details, and finish with a measurable outcome (for example, latency reduced by 35% or team delivery velocity improved).`,
    };
  });

  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 70;
  const communication = Math.min(96, avg + 3);
  const technical_depth = Math.max(45, avg - (interviewType === 'Technical' ? 2 : 0));
  const confidence = Math.min(95, avg + 1);
  const relevance = Math.min(96, avg + 2);
  const overall_score = Math.round((communication + technical_depth + confidence + relevance) / 4);

  let verdict = 'Developing';
  if (overall_score >= 85) verdict = 'Strong Hire';
  else if (overall_score >= 72) verdict = 'Hire';
  else if (overall_score >= 58) verdict = 'Leaning Hire';

  return {
    overall_score,
    dimensions: { communication, technical_depth, confidence, relevance },
    verdict,
    summary: `Demo evaluation for ${experienceLevel} ${role} (${interviewType}): You completed ${turns.length} interview turns with an overall readiness score of ${overall_score}/100. Focus on pairing clear STAR/system-design structure with quantified outcomes.`,
    strengths: [
      'Maintained clear relevance to the prompt and role expectations.',
      'Engaged constructively with follow-up probing.',
      'Paced responses steadily within the per-question timer window.',
    ],
    weak_areas: [
      'Include more explicit quantitative outcomes (latency, conversion, error rate, or time saved).',
      'Call out rejected alternatives and architectural/process trade-offs upfront.',
    ],
    question_breakdown: breakdown,
  };
}

async function generateFinalReport(
  role: string,
  experienceLevel: string,
  interviewType: string,
  turns: TurnRecord[],
  jobDescription: string | null,
) {
  const hasAnyAnswer = turns.some((t) => (t.answer_text || '').trim().length > 0);
  if (isDemoModeEnabled() || !hasAnyAnswer) {
    return demoFinalReport(role, experienceLevel, interviewType, turns);
  }

  const transcript = turns
    .map(
      (t, idx) =>
        `Turn ${idx + 1} (Q${t.question_number}${t.is_followup ? ' Follow-up' : ''}, ${t.duration_seconds || 0}s):\nQuestion: ${t.question_text}\nCandidate Answer: ${t.answer_text || '(Skipped / No answer)'}`,
    )
    .join('\n\n');

  const prompt = `Evaluate this completed ${experienceLevel} ${role} (${interviewType}) interview rigorously and fairly.
Job Description context: ${(jobDescription || 'Not provided').slice(0, 1500)}

Full Interview Transcript:
${transcript}

Return JSON with this exact schema:
{
  "overall_score": <integer 0-100>,
  "dimensions": {
    "communication": <integer 0-100>,
    "technical_depth": <integer 0-100>,
    "confidence": <integer 0-100>,
    "relevance": <integer 0-100>
  },
  "verdict": "Strong Hire" | "Hire" | "Leaning Hire" | "Developing",
  "summary": "2-3 sentence executive summary of the candidate's performance.",
  "strengths": ["3-4 concise concrete strengths grounded in the answers"],
  "weak_areas": ["2-4 actionable areas for improvement"],
  "question_breakdown": [
    {
      "question_number": <integer>,
      "is_followup": <boolean>,
      "question": "exact question asked",
      "user_answer": "candidate answer",
      "score": <integer 0-100>,
      "feedback": "1-2 sentence targeted critique",
      "model_answer": "concise high-scoring exemplary answer tailored to the role"
    }
  ]
}`;

  try {
    const data = await callAiJson(prompt, 2400);
    const dims = (data.dimensions || {}) as Record<string, unknown>;
    const communication = clampScore(dims.communication, 74);
    const technical_depth = clampScore(dims.technical_depth, 72);
    const confidence = clampScore(dims.confidence, 75);
    const relevance = clampScore(dims.relevance, 76);
    const overall_score = clampScore(
      data.overall_score,
      Math.round((communication + technical_depth + confidence + relevance) / 4),
    );

    let verdict = String(data.verdict || '').trim();
    if (!['Strong Hire', 'Hire', 'Leaning Hire', 'Developing'].includes(verdict)) {
      if (overall_score >= 85) verdict = 'Strong Hire';
      else if (overall_score >= 72) verdict = 'Hire';
      else if (overall_score >= 58) verdict = 'Leaning Hire';
      else verdict = 'Developing';
    }

    const rawBreakdown = Array.isArray(data.question_breakdown) ? data.question_breakdown : [];
    const question_breakdown = turns.map((turn, idx) => {
      const item = (rawBreakdown[idx] && typeof rawBreakdown[idx] === 'object'
        ? rawBreakdown[idx]
        : {}) as Record<string, unknown>;
      return {
        question_number: turn.question_number,
        is_followup: turn.is_followup,
        question: String(item.question || turn.question_text),
        user_answer: String(item.user_answer || turn.answer_text || '(No response provided)'),
        score: clampScore(item.score, overall_score),
        feedback: String(
          item.feedback ||
            'Clear response; adding measurable outcomes and trade-offs would strengthen it further.',
        ),
        model_answer: String(
          item.model_answer ||
            'Structure your response using context, concrete decisions, trade-offs evaluated, and measurable impact.',
        ),
      };
    });

    const strengths = Array.isArray(data.strengths)
      ? data.strengths.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [];
    const weak_areas = Array.isArray(data.weak_areas)
      ? data.weak_areas.map((w) => String(w).trim()).filter(Boolean).slice(0, 5)
      : [];

    return {
      overall_score,
      dimensions: { communication, technical_depth, confidence, relevance },
      verdict,
      summary: String(
        data.summary ||
          "The candidate communicated clearly and demonstrated solid alignment with the role's expectations.",
      ),
      strengths: strengths.length > 0 ? strengths : ['Clear structure when framing problem context.'],
      weak_areas: weak_areas.length > 0 ? weak_areas : ['Quantify outcomes with concrete metrics where possible.'],
      question_breakdown,
    };
  } catch (err) {
    console.error('[AI] generateFinalReport fallback:', (err as Error).message);
    return demoFinalReport(role, experienceLevel, interviewType, turns);
  }
}

function formatSession(row: SessionRecord) {
  return {
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    experience_level: row.experience_level,
    interview_type: row.interview_type,
    total_questions: row.total_questions,
    seconds_per_question: row.seconds_per_question,
    current_question_index: row.current_question_index,
    has_resume: Boolean(row.resume_text),
    has_job_description: Boolean(row.job_description),
    demo_mode: Boolean(row.demo_mode),
    status: row.status,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

function formatTurn(row: TurnRecord): TurnRecord {
  return {
    id: row.id,
    session_id: row.session_id,
    sequence_number: row.sequence_number,
    question_number: row.question_number,
    is_followup: Boolean(row.is_followup),
    question_text: row.question_text,
    answer_text: row.answer_text,
    duration_seconds: row.duration_seconds,
    interviewer_transition: row.interviewer_transition,
    created_at: row.created_at,
  };
}

function formatReport(row: ReportRecord) {
  return {
    session_id: row.session_id,
    overall_score: row.overall_score,
    dimensions: {
      communication: row.communication_score,
      technical_depth: row.technical_depth_score,
      confidence: row.confidence_score,
      relevance: row.relevance_score,
    },
    verdict: row.verdict,
    summary: row.summary,
    strengths: row.strengths,
    weak_areas: row.weak_areas,
    question_breakdown: row.question_breakdown,
    created_at: row.created_at,
  };
}

// Parse multipart/form-data upload cleanly without extra middleware dependencies
function parseMultipartPdf(bodyBuffer: Buffer, contentType: string): { filename: string; fileBytes: Buffer } {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!boundaryMatch) {
    throw new Error('Invalid multipart/form-data request: missing boundary.');
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const boundaryMarker = Buffer.from(`--${boundary}`);
  const headerSep = Buffer.from('\r\n\r\n');

  let pos = bodyBuffer.indexOf(boundaryMarker);
  while (pos !== -1) {
    const partStart = pos + boundaryMarker.length;
    if (bodyBuffer.slice(partStart, partStart + 2).equals(Buffer.from('--'))) break;

    const nextPos = bodyBuffer.indexOf(boundaryMarker, partStart);
    if (nextPos === -1) break;

    const part = bodyBuffer.slice(partStart + 2, nextPos - 2); // strip leading \r\n and trailing \r\n
    const sepIdx = part.indexOf(headerSep);
    if (sepIdx !== -1) {
      const headersText = part.slice(0, sepIdx).toString('utf8');
      if (/name="file"/i.test(headersText)) {
        const filenameMatch = headersText.match(/filename="([^"]*)"/i);
        const filename = filenameMatch?.[1] || 'resume.pdf';
        const fileBytes = part.slice(sepIdx + headerSep.length);
        return { filename, fileBytes };
      }
    }
    pos = nextPos;
  }

  throw new Error("Please attach a PDF file under the 'file' form field.");
}

async function startServer() {
  const app = express();
  const flaskBackendUrl = (process.env.FLASK_BACKEND_URL || '').trim().replace(/\/$/, '');

  if (!flaskBackendUrl) {
    store = await createDataStore();
    console.log(`Database connected: ${store.engine} (${store.databaseName})`);
  }

  // CORS headers for cross-origin local development
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Optional transparent proxy if user starts local Flask server and sets FLASK_BACKEND_URL
  if (flaskBackendUrl) {
    app.use('/api', async (req: Request, res: Response) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const rawBody = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
        const headers: Record<string, string> = {};
        if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);
        if (req.headers.authorization) headers.authorization = String(req.headers.authorization);

        const targetUrl = `${flaskBackendUrl}${req.originalUrl}`;
        const upstream = await fetch(targetUrl, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : rawBody,
        });
        const upstreamBody = Buffer.from(await upstream.arrayBuffer());
        res.status(upstream.status);
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        res.send(upstreamBody);
      } catch (err) {
        res.status(502).json({
          error: `Could not reach Flask backend at ${flaskBackendUrl}: ${(err as Error).message}`,
        });
      }
    });
  } else {
    app.post(
      '/api/resume/parse',
      requireAuth,
      express.raw({ type: 'multipart/form-data', limit: '6mb' }),
      async (req: Request, res: Response) => {
        try {
          const contentType = String(req.headers['content-type'] || '');
          if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            res.status(400).json({ error: 'No PDF file uploaded.' });
            return;
          }

          const { filename, fileBytes } = parseMultipartPdf(req.body, contentType);
          if (fileBytes.length === 0) {
            res.status(400).json({ error: 'Uploaded PDF file is empty.' });
            return;
          }
          if (fileBytes.length > MAX_RESUME_BYTES) {
            res.status(400).json({ error: 'Resume PDF exceeds the 5 MB file size limit.' });
            return;
          }
          const isPdfSignature = fileBytes.slice(0, 4).toString('utf8') === '%PDF';
          if (!filename.toLowerCase().endsWith('.pdf') && !isPdfSignature) {
            res.status(400).json({ error: 'Only valid PDF files are supported.' });
            return;
          }

          const pdf = await getDocumentProxy(new Uint8Array(fileBytes));
          const { totalPages, text } = await extractText(pdf, { mergePages: true });
          const normalized = text
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          if (!normalized) {
            res.status(400).json({
              error:
                'No selectable text was found in this PDF. Please upload a text-based PDF or paste your resume summary.',
            });
            return;
          }

          let truncated = false;
          let finalText = normalized;
          if (finalText.length > MAX_RESUME_CHARS) {
            finalText = `${finalText.slice(0, MAX_RESUME_CHARS).trimEnd()}...`;
            truncated = true;
          }

          res.json({
            filename,
            page_count: totalPages,
            word_count: finalText.split(/\s+/).length,
            char_count: finalText.length,
            truncated,
            text: finalText,
          });
        } catch (err) {
          res.status(400).json({ error: (err as Error).message || 'Failed to parse PDF resume.' });
        }
      },
    );

    app.use('/api', express.json({ limit: '1mb' }));

    app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        backend: store.engine === 'mongodb' ? 'node-mongodb' : 'node-sqlite',
        database: store.engine,
        database_name: store.databaseName,
        demo_mode: isDemoModeEnabled(),
        ai_provider: getActiveAiProvider(),
      });
    });

    app.post('/api/auth/register', async (req: Request, res: Response) => {
      try {
        const body = req.body || {};
        const fullName = String(body.full_name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (fullName.length < 2 || fullName.length > 80) {
          res.status(400).json({ error: 'Please enter your full name (2–80 characters).' });
          return;
        }
        if (!EMAIL_RE.test(email)) {
          res.status(400).json({ error: 'Please enter a valid email address.' });
          return;
        }
        if (password.length < 8) {
          res.status(400).json({ error: 'Password must be at least 8 characters long.' });
          return;
        }

        const existing = await store.findUserByEmail(email);
        if (existing) {
          res.status(409).json({ error: 'An account with this email already exists.' });
          return;
        }

        const userId = crypto.randomUUID();
        const now = new Date().toISOString();
        const passwordHash = hashPassword(password);

        const userRow = await store.createUser({
          id: userId,
          full_name: fullName,
          email,
          password_hash: passwordHash,
          created_at: now,
        });

        res.status(201).json({
          token: createAuthToken(userId),
          user: formatUser(userRow),
        });
      } catch (err) {
        res.status(500).json({ error: `Registration failed: ${(err as Error).message}` });
      }
    });

    app.post('/api/auth/login', async (req: Request, res: Response) => {
      try {
        const body = req.body || {};
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!EMAIL_RE.test(email) || !password) {
          res.status(400).json({ error: 'Please enter both your email and password.' });
          return;
        }

        const userRow = await store.findUserByEmail(email);
        if (!userRow || !verifyPassword(password, userRow.password_hash)) {
          res.status(401).json({ error: 'Invalid email or password.' });
          return;
        }

        res.json({
          token: createAuthToken(userRow.id),
          user: formatUser(userRow),
        });
      } catch (err) {
        res.status(500).json({ error: `Login failed: ${(err as Error).message}` });
      }
    });

    app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
      res.json({ user: formatUser(req.authUser!) });
    });

    app.post('/api/auth/logout', (_req: Request, res: Response) => {
      res.json({ ok: true });
    });

    app.post('/api/interview/start', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body || {};
        const role = String(body.role || '').trim();
        const experienceLevel = String(body.experience_level || 'Mid').trim();
        const interviewType = String(body.interview_type || 'Mixed').trim();
        const totalQuestions = Number(body.total_questions ?? 5);
        const secondsRaw = Number(body.seconds_per_question ?? 120);
        const resumeText = String(body.resume_text || '').trim() || null;
        const jobDescription = String(body.job_description || '').trim() || null;

        if (role.length < 2 || role.length > 120) {
          res.status(400).json({ error: 'Please enter a valid job role (2–120 characters).' });
          return;
        }
        if (!VALID_LEVELS.has(experienceLevel)) {
          res.status(400).json({ error: 'Invalid experience level.' });
          return;
        }
        if (!VALID_TYPES.has(interviewType)) {
          res.status(400).json({ error: 'Invalid interview type.' });
          return;
        }
        if (!Number.isInteger(totalQuestions) || totalQuestions < 5 || totalQuestions > 10) {
          res.status(400).json({ error: 'total_questions must be an integer between 5 and 10.' });
          return;
        }
        const secondsPerQuestion = Number.isFinite(secondsRaw)
          ? Math.max(45, Math.min(300, Math.round(secondsRaw)))
          : 120;

        const demoMode = isDemoModeEnabled();
        const opening = await generateOpeningQuestion(
          role,
          experienceLevel,
          interviewType,
          totalQuestions,
          resumeText,
          jobDescription,
        );

        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();

        const { session: sessionRow, turn: turnRow } = await store.createSessionAndFirstTurn(
          {
            id: sessionId,
            user_id: req.authUser!.id,
            role,
            experience_level: experienceLevel,
            interview_type: interviewType,
            total_questions: totalQuestions,
            seconds_per_question: secondsPerQuestion,
            current_question_index: 1,
            resume_text: resumeText,
            job_description: jobDescription,
            demo_mode: demoMode,
            status: 'in_progress',
            created_at: now,
          },
          opening.question,
        );

        res.status(201).json({
          session: formatSession(sessionRow),
          greeting: opening.greeting,
          current_turn: formatTurn(turnRow),
        });
      } catch (err) {
        res.status(500).json({ error: `Failed to start interview: ${(err as Error).message}` });
      }
    });

    app.post('/api/interview/answer', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body || {};
        const sessionId = String(body.session_id || '').trim();
        const answerText = String(body.answer_text || '').trim();
        const durationSeconds = Math.max(0, Math.round(Number(body.duration_seconds || 0) || 0));

        if (!sessionId) {
          res.status(400).json({ error: 'session_id is required.' });
          return;
        }
        if (!answerText) {
          res.status(400).json({ error: 'Please enter or dictate an answer before submitting.' });
          return;
        }

        let sessionRow = await store.findSessionById(sessionId);
        if (!sessionRow || sessionRow.user_id !== req.authUser!.id) {
          res.status(404).json({ error: 'Interview session not found.' });
          return;
        }
        if (sessionRow.status === 'completed') {
          res.status(400).json({ error: 'This interview session is already completed.' });
          return;
        }

        const turnRows = await store.listTurnsForSession(sessionId);
        if (turnRows.length === 0) {
          res.status(400).json({ error: 'Session has no active question.' });
          return;
        }

        const latestTurn = turnRows[turnRows.length - 1];
        await store.updateTurnAnswer(latestTurn.id, answerText, durationSeconds);
        latestTurn.answer_text = answerText;
        latestTurn.duration_seconds = durationSeconds;

        const turns = turnRows.map(formatTurn);
        const alreadyFollowedUp = turns.some(
          (t) => t.question_number === latestTurn.question_number && t.is_followup,
        );

        const decision = await processCandidateAnswer(
          sessionRow.role,
          sessionRow.experience_level,
          sessionRow.interview_type,
          sessionRow.total_questions,
          sessionRow.current_question_index,
          alreadyFollowedUp,
          turns,
          sessionRow.resume_text,
          sessionRow.job_description,
        );

        await store.updateTurnTransition(latestTurn.id, decision.transition);

        let nextTurn: TurnRecord | null = null;
        const now = new Date().toISOString();

        if (decision.action === 'ask_followup') {
          const created = await store.createTurn({
            session_id: sessionId,
            sequence_number: turns.length + 1,
            question_number: sessionRow.current_question_index,
            is_followup: true,
            question_text: decision.next_question,
            answer_text: null,
            duration_seconds: null,
            interviewer_transition: null,
            created_at: now,
          });
          nextTurn = formatTurn(created);
        } else if (decision.action === 'next_question') {
          const nextQIndex = sessionRow.current_question_index + 1;
          sessionRow = (await store.incrementSessionQuestionIndex(sessionId, nextQIndex)) || {
            ...sessionRow,
            current_question_index: nextQIndex,
          };

          const created = await store.createTurn({
            session_id: sessionId,
            sequence_number: turns.length + 1,
            question_number: nextQIndex,
            is_followup: false,
            question_text: decision.next_question,
            answer_text: null,
            duration_seconds: null,
            interviewer_transition: null,
            created_at: now,
          });
          nextTurn = formatTurn(created);
        }

        res.json({
          action: decision.action,
          transition: decision.transition,
          session: formatSession(sessionRow),
          next_turn: nextTurn,
        });
      } catch (err) {
        res.status(500).json({ error: `Failed to process answer: ${(err as Error).message}` });
      }
    });

    app.post('/api/interview/finish', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body || {};
        const sessionId = String(body.session_id || '').trim();
        if (!sessionId) {
          res.status(400).json({ error: 'session_id is required.' });
          return;
        }

        const sessionRow = await store.findSessionById(sessionId);
        if (!sessionRow || sessionRow.user_id !== req.authUser!.id) {
          res.status(404).json({ error: 'Interview session not found.' });
          return;
        }

        const existingReport = await store.findReportBySessionId(sessionId);
        if (existingReport) {
          res.json({
            session: formatSession(sessionRow),
            report: formatReport(existingReport),
          });
          return;
        }

        const turns = (await store.listTurnsForSession(sessionId)).map(formatTurn);
        const reportData = await generateFinalReport(
          sessionRow.role,
          sessionRow.experience_level,
          sessionRow.interview_type,
          turns,
          sessionRow.job_description,
        );

        const now = new Date().toISOString();
        const reportDoc: ReportRecord = {
          session_id: sessionId,
          overall_score: reportData.overall_score,
          communication_score: reportData.dimensions.communication,
          technical_depth_score: reportData.dimensions.technical_depth,
          confidence_score: reportData.dimensions.confidence,
          relevance_score: reportData.dimensions.relevance,
          verdict: reportData.verdict,
          summary: reportData.summary,
          strengths: reportData.strengths,
          weak_areas: reportData.weak_areas,
          question_breakdown: reportData.question_breakdown,
          created_at: now,
        };

        const { session: updatedSession, report: savedReport } =
          await store.saveReportAndCompleteSession(reportDoc);

        res.json({
          session: formatSession(updatedSession),
          report: formatReport(savedReport),
        });
      } catch (err) {
        res.status(500).json({ error: `Failed to finish interview: ${(err as Error).message}` });
      }
    });

    app.get('/api/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const items = await store.listCompletedHistoryForUser(req.authUser!.id);

        const history = items.map(({ session, report }) => ({
          session: formatSession(session),
          overall_score: report.overall_score,
          dimensions: {
            communication: report.communication_score,
            technical_depth: report.technical_depth_score,
            confidence: report.confidence_score,
            relevance: report.relevance_score,
          },
          verdict: report.verdict,
          report: formatReport(report),
        }));

        res.json({ history });
      } catch (err) {
        res.status(500).json({ error: `Failed to fetch history: ${(err as Error).message}` });
      }
    });

    app.get('/api/history/:sessionId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const sessionRow = await store.findSessionById(String(req.params.sessionId));
        const reportRow = await store.findReportBySessionId(String(req.params.sessionId));

        if (!sessionRow || sessionRow.user_id !== req.authUser!.id || !reportRow) {
          res.status(404).json({ error: 'Completed interview report not found.' });
          return;
        }

        res.json({
          session: formatSession(sessionRow),
          report: formatReport(reportRow),
        });
      } catch (err) {
        res.status(500).json({ error: `Failed to load report: ${(err as Error).message}` });
      }
    });
  }

  // Serve Vite middleware in development or built static assets in production
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Interview Simulator server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
