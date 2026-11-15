"""
AI interviewer service supporting Google Gemini and Anthropic with safe
structured JSON parsing and a deterministic Demo Mode fallback.
"""

import json
import os
import re
import urllib.request
from typing import Any, Optional

from anthropic import Anthropic

DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
DEFAULT_MODEL = "claude-sonnet-4-20250514"

INTERVIEWER_SYSTEM_PROMPT = """You are a friendly, clear, and fair job interviewer.
Your style is simple, direct, and easy to understand:
- Ask one short, plain-English question at a time tailored to the candidate's target role, experience level, interview type, resume, and job description.
- Keep questions concise (1 clear sentence, no jargon or multi-part walls of text).
- Do NOT include long welcome speeches or introductions like "Welcome! I'll be conducting your interview today." Jump straight into the question.
- Listen carefully to each answer. If an answer is very short or unclear, ask ONE simple follow-up question. Otherwise give a brief 3–6 word acknowledgement and ask the next question.
- Never reveal internal rubrics or break character during the interview.
- Always respond strictly with valid JSON matching the requested schema, with no markdown fences or extra commentary outside the JSON object."""


def _configured_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key or key in {"MY_GEMINI_API_KEY", "your-gemini-api-key"}:
        return ""
    return key


def _configured_anthropic_key() -> str:
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key or key == "your-anthropic-api-key":
        return ""
    return key


def is_demo_mode_enabled() -> bool:
    force_demo = os.getenv("DEMO_MODE", "false").strip().lower() == "true"
    return force_demo or (not _configured_gemini_key() and not _configured_anthropic_key())


def extract_json_object(raw_text: str) -> dict[str, Any]:
    """Safely parse JSON from model output even if wrapped in prose or code fences."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("Model response did not contain a valid JSON object.")

    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON payload was not an object.")
    return parsed


def _get_client() -> Anthropic:
    return Anthropic(api_key=_configured_anthropic_key())


def _get_model() -> str:
    return os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def _call_gemini_json(user_prompt: str) -> dict[str, Any]:
    api_key = _configured_gemini_key()
    model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": INTERVIEWER_SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
            "User-Agent": "aistudio-build",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(p.get("text", "") for p in parts if isinstance(p, dict))
    return extract_json_object(text)


def _call_anthropic_json(user_prompt: str, max_tokens: int = 1400) -> dict[str, Any]:
    if _configured_gemini_key():
        return _call_gemini_json(user_prompt)
    client = _get_client()
    response = client.messages.create(
        model=_get_model(),
        max_tokens=max_tokens,
        temperature=0.4,
        system=INTERVIEWER_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text_blocks = [
        block.text for block in response.content if getattr(block, "type", "") == "text"
    ]
    return extract_json_object("\n".join(text_blocks))


def generate_opening_question(
    role: str,
    experience_level: str,
    interview_type: str,
    total_questions: int,
    resume_text: Optional[str] = None,
    job_description: Optional[str] = None,
) -> dict[str, str]:
    """Generate the greeting and first interview question."""
    if is_demo_mode_enabled():
        return _demo_opening_question(role, experience_level, interview_type, resume_text)

    context_parts = [
        f"Target Role: {role}",
        f"Experience Level: {experience_level}",
        f"Interview Type: {interview_type}",
        f"Planned Core Questions: {total_questions}",
    ]
    if resume_text:
        context_parts.append(f"Candidate Resume Excerpt:\n{resume_text[:3500]}")
    if job_description:
        context_parts.append(f"Job Description Excerpt:\n{job_description[:3000]}")

    prompt = f"""Ask Question 1 of {total_questions} directly in simple, clear, everyday English (1 short sentence). Do not include any welcome speech or introduction.

Context:
{chr(10).join(context_parts)}

Return JSON with this exact schema:
{{
  "greeting": "",
  "question": "Simple, clear Question 1"
}}"""

    try:
        data = _call_anthropic_json(prompt, max_tokens=400)
        return {
            "greeting": str(data.get("greeting", "")).strip(),
            "question": str(data.get("question", "")).strip()
            or _demo_opening_question(role, experience_level, interview_type, resume_text)["question"],
        }
    except Exception:
        return _demo_opening_question(role, experience_level, interview_type, resume_text)


def process_candidate_answer(
    role: str,
    experience_level: str,
    interview_type: str,
    total_questions: int,
    current_question_number: int,
    already_followed_up_current: bool,
    turns_history: list[dict[str, Any]],
    resume_text: Optional[str] = None,
    job_description: Optional[str] = None,
) -> dict[str, Any]:
    """
    Evaluate the candidate's latest answer and decide whether to:
    - ask_followup (stay on current_question_number),
    - next_question (advance to current_question_number + 1), or
    - complete (all planned core questions have been covered).
    """
    if is_demo_mode_enabled():
        return _demo_next_step(
            role=role,
            experience_level=experience_level,
            interview_type=interview_type,
            total_questions=total_questions,
            current_question_number=current_question_number,
            already_followed_up_current=already_followed_up_current,
            turns_history=turns_history,
        )

    transcript = "\n\n".join(
        f"[Q{t['question_number']}{' Follow-up' if t['is_followup'] else ''}] Interviewer: {t['question_text']}\nCandidate: {t.get('answer_text') or '(No answer)'}"
        for t in turns_history
    )

    followup_rule = (
        "You already asked a follow-up on this question, so you MUST NOT ask another follow-up; either move to the next core question or complete the interview if all questions are done."
        if already_followed_up_current
        else "If the latest answer is very brief or vague, set action to 'ask_followup' and ask 1 short, easy-to-understand follow-up. Otherwise advance."
    )

    is_last_core_question = current_question_number >= total_questions

    prompt = f"""You are continuing an interview for a {experience_level} {role} ({interview_type} focus).
Keep your follow-up or next question short, simple, and easy to understand in plain English.
Core question progress: {current_question_number} of {total_questions}.
{followup_rule}
{"Note: This was the final planned core question. Unless a single simple follow-up is essential (and none was asked yet), set action to 'complete'." if is_last_core_question else ""}

Resume snippet: {(resume_text or 'None provided')[:1500]}
Job description snippet: {(job_description or 'None provided')[:1500]}

Transcript so far:
{transcript}

Return JSON with this exact schema:
{{
  "action": "ask_followup" | "next_question" | "complete",
  "transition": "Short 3-6 word acknowledgement (e.g. 'Got it, thanks.')",
  "next_question": "Short, plain-English follow-up or next question (empty string if action is 'complete')"
}}"""

    try:
        data = _call_anthropic_json(prompt, max_tokens=700)
        action = str(data.get("action", "next_question")).strip()
        if already_followed_up_current and action == "ask_followup":
            action = "complete" if is_last_core_question else "next_question"
        if action not in {"ask_followup", "next_question", "complete"}:
            action = "complete" if is_last_core_question else "next_question"
        if action == "next_question" and is_last_core_question:
            action = "complete"

        transition = str(data.get("transition", "")).strip() or "Thank you for sharing that perspective."
        next_q = str(data.get("next_question", "")).strip()
        if action != "complete" and not next_q:
            fallback = _demo_next_step(
                role, experience_level, interview_type, total_questions,
                current_question_number, already_followed_up_current, turns_history
            )
            return fallback

        return {
            "action": action,
            "transition": transition,
            "next_question": next_q,
        }
    except Exception:
        return _demo_next_step(
            role, experience_level, interview_type, total_questions,
            current_question_number, already_followed_up_current, turns_history
        )


def generate_final_report(
    role: str,
    experience_level: str,
    interview_type: str,
    turns_history: list[dict[str, Any]],
    job_description: Optional[str] = None,
) -> dict[str, Any]:
    """Produce structured scoring, strengths, weak areas, and per-question model answers."""
    answered_turns = [t for t in turns_history if (t.get("answer_text") or "").strip()]
    if is_demo_mode_enabled() or not answered_turns:
        return _demo_final_report(role, experience_level, interview_type, turns_history)

    transcript = "\n\n".join(
        f"Turn {idx + 1} (Q{t['question_number']}{' Follow-up' if t['is_followup'] else ''}, {t.get('duration_seconds') or 0}s):\n"
        f"Question: {t['question_text']}\n"
        f"Candidate Answer: {t.get('answer_text') or '(Skipped / No answer)'}"
        for idx, t in enumerate(turns_history)
    )

    prompt = f"""Evaluate this completed {experience_level} {role} ({interview_type}) interview rigorously and fairly.
Job Description context: {(job_description or 'Not provided')[:1500]}

Full Interview Transcript:
{transcript}

Return JSON with this exact schema:
{{
  "overall_score": <integer 0-100>,
  "dimensions": {{
    "communication": <integer 0-100>,
    "technical_depth": <integer 0-100>,
    "confidence": <integer 0-100>,
    "relevance": <integer 0-100>
  }},
  "verdict": "Strong Hire" | "Hire" | "Leaning Hire" | "Developing",
  "summary": "2-3 sentence executive summary of the candidate's performance.",
  "strengths": ["3-4 concise concrete strengths grounded in the answers"],
  "weak_areas": ["2-4 actionable areas for improvement"],
  "question_breakdown": [
    {{
      "question_number": <integer>,
      "is_followup": <boolean>,
      "question": "exact question asked",
      "user_answer": "candidate answer",
      "score": <integer 0-100>,
      "feedback": "1-2 sentence targeted critique",
      "model_answer": "concise high-scoring exemplary answer tailored to the role"
    }}
  ]
}}"""

    try:
        data = _call_anthropic_json(prompt, max_tokens=2400)
        return _sanitize_report_payload(data, turns_history)
    except Exception:
        return _demo_final_report(role, experience_level, interview_type, turns_history)


def _clamp_score(value: Any, default: int = 72) -> int:
    try:
        num = int(round(float(value)))
        return max(0, min(100, num))
    except (TypeError, ValueError):
        return default


def _sanitize_report_payload(data: dict[str, Any], turns_history: list[dict[str, Any]]) -> dict[str, Any]:
    dims = data.get("dimensions") or {}
    communication = _clamp_score(dims.get("communication"), 74)
    technical_depth = _clamp_score(dims.get("technical_depth"), 72)
    confidence = _clamp_score(dims.get("confidence"), 75)
    relevance = _clamp_score(dims.get("relevance"), 76)
    overall = _clamp_score(
        data.get("overall_score"),
        round((communication + technical_depth + confidence + relevance) / 4),
    )

    verdict = str(data.get("verdict", "")).strip()
    if verdict not in {"Strong Hire", "Hire", "Leaning Hire", "Developing"}:
        if overall >= 85:
            verdict = "Strong Hire"
        elif overall >= 72:
            verdict = "Hire"
        elif overall >= 58:
            verdict = "Leaning Hire"
        else:
            verdict = "Developing"

    breakdown = []
    raw_breakdown = data.get("question_breakdown") or []
    for idx, turn in enumerate(turns_history):
        item = raw_breakdown[idx] if idx < len(raw_breakdown) and isinstance(raw_breakdown[idx], dict) else {}
        breakdown.append({
            "question_number": turn["question_number"],
            "is_followup": bool(turn["is_followup"]),
            "question": str(item.get("question") or turn["question_text"]),
            "user_answer": str(item.get("user_answer") or turn.get("answer_text") or "(No response provided)"),
            "score": _clamp_score(item.get("score"), overall),
            "feedback": str(item.get("feedback") or "Clear response; adding measurable outcomes and trade-offs would strengthen it further."),
            "model_answer": str(item.get("model_answer") or "Structure your response using context, concrete technical or strategic decisions, trade-offs evaluated, and measurable impact."),
        })

    return {
        "overall_score": overall,
        "dimensions": {
            "communication": communication,
            "technical_depth": technical_depth,
            "confidence": confidence,
            "relevance": relevance,
        },
        "verdict": verdict,
        "summary": str(data.get("summary") or "The candidate communicated clearly and demonstrated solid alignment with the role's expectations."),
        "strengths": [str(s) for s in (data.get("strengths") or []) if str(s).strip()][:5]
        or ["Clear structure when framing problem context."],
        "weak_areas": [str(w) for w in (data.get("weak_areas") or []) if str(w).strip()][:5]
        or ["Quantify outcomes with concrete metrics where possible."],
        "question_breakdown": breakdown,
    }


# ---------------------------------------------------------------------------
# Deterministic, realistic Demo Mode (works cleanly with zero API keys)
# ---------------------------------------------------------------------------

def _demo_question_bank(role: str, experience_level: str, interview_type: str) -> list[str]:
    banks = {
        "Technical": [
            f"Tell me about a {role} project you worked on recently and what you built.",
            "When something breaks in your code, how do you usually find and fix the bug?",
            "Explain a technical concept you use often in simple words.",
            "How do you keep your code clean and easy for others to read?",
            "Tell me about a tough technical problem you ran into and how you solved it.",
            "How do you test your work before sharing it with your team?",
            "Tell me about a time you had to learn a new tool or language quickly.",
            "If a page or app feels slow, what do you check first?",
            "How do you plan out the structure of a new feature before coding?",
            f"What tool or technology do you enjoy using most as a {role}, and why?",
        ],
        "Behavioral": [
            "Tell me about a time you worked with a team to finish a project.",
            "Describe a time you disagreed with a teammate. How did you work it out?",
            "Tell me about a mistake you made and what you learned from it.",
            "Describe a time plans or requirements changed suddenly. What did you do?",
            "Tell me about a time you helped a teammate who was stuck.",
            "Have you ever had to make a quick decision without having all the information?",
            "Tell me about helpful feedback you received and how you used it.",
            "Describe a time you took initiative without waiting to be asked.",
            "How do you handle having several urgent tasks at the same time?",
            "What keeps you motivated when a task gets difficult?",
        ],
        "HR": [
            f"Tell me a little about yourself and why you are interested in this {role} role.",
            "What kind of team environment helps you do your best work?",
            "Tell me about a project or achievement you are proud of.",
            "What are your biggest strengths, and what is one skill you want to improve?",
            "How do you handle feedback when someone points out something to fix?",
            "How do you stay organized when juggling multiple deadlines?",
            f"What do you hope to learn or achieve in the next year as a {role}?",
            "Tell me about a time you had to figure things out without clear instructions.",
            "How do you stay calm and focused under pressure?",
            "What questions would you ask a hiring manager before joining a team?",
        ],
    }
    if interview_type == "Mixed":
        return [
            banks["HR"][0],
            banks["Technical"][0],
            banks["Behavioral"][0],
            banks["Technical"][1],
            banks["Behavioral"][1],
            banks["Technical"][2],
            banks["Behavioral"][2],
            banks["Technical"][3],
            banks["HR"][6],
            banks["Technical"][4],
        ]
    return banks.get(interview_type, banks["Technical"])


def _demo_opening_question(
    role: str, experience_level: str, interview_type: str, resume_text: Optional[str]
) -> dict[str, str]:
    bank = _demo_question_bank(role, experience_level, interview_type)
    return {
        "greeting": "",
        "question": bank[0],
    }


def _demo_next_step(
    role: str,
    experience_level: str,
    interview_type: str,
    total_questions: int,
    current_question_number: int,
    already_followed_up_current: bool,
    turns_history: list[dict[str, Any]],
) -> dict[str, Any]:
    last_answer = (turns_history[-1].get("answer_text") or "").strip() if turns_history else ""
    word_count = len(last_answer.split())

    # Ask a simple follow-up if the answer is very brief (< 20 words)
    if not already_followed_up_current and word_count < 20:
        return {
            "action": "ask_followup",
            "transition": "Got it.",
            "next_question": "Can you give a quick example or a bit more detail about what you did?",
        }

    if current_question_number >= total_questions:
        return {
            "action": "complete",
            "transition": "Thanks for your answers. Preparing your report now.",
            "next_question": "",
        }

    bank = _demo_question_bank(role, experience_level, interview_type)
    next_idx = current_question_number
    next_q = bank[next_idx % len(bank)]
    return {
        "action": "next_question",
        "transition": "Thanks for sharing that.",
        "next_question": next_q,
    }


def _demo_final_report(
    role: str,
    experience_level: str,
    interview_type: str,
    turns_history: list[dict[str, Any]],
) -> dict[str, Any]:
    breakdown = []
    scores = []
    for turn in turns_history:
        ans = (turn.get("answer_text") or "").strip()
        wc = len(ans.split())
        has_numbers = bool(re.search(r"\d", ans))
        has_structure = any(
            kw in ans.lower()
            for kw in ["because", "trade-off", "result", "impact", "designed", "led", "measured", "learned", "metric"]
        )

        if wc == 0:
            q_score = 35
            feedback = "No response was recorded for this prompt. Practice delivering a concise 60-second structured response even under time pressure."
        else:
            q_score = min(94, 58 + min(22, wc // 3) + (7 if has_numbers else 0) + (7 if has_structure else 0))
            feedback = (
                "Strong specificity and clear cause-and-effect framing."
                if q_score >= 80
                else "Solid core idea; adding concrete metrics, constraints, and alternatives considered would elevate the answer."
            )

        scores.append(q_score)
        breakdown.append({
            "question_number": turn["question_number"],
            "is_followup": bool(turn["is_followup"]),
            "question": turn["question_text"],
            "user_answer": ans or "(No response provided)",
            "score": q_score,
            "feedback": feedback,
            "model_answer": (
                f"In a {experience_level} {role} scenario, start with 1–2 sentences of context and constraints, "
                "explain the two options you evaluated and why you selected your approach, describe execution details, "
                "and finish with a measurable outcome (for example, latency reduced by 35% or team delivery velocity improved)."
            ),
        })

    avg = round(sum(scores) / len(scores)) if scores else 70
    communication = min(96, avg + 3)
    technical_depth = max(45, avg - (2 if interview_type == "Technical" else 0))
    confidence = min(95, avg + 1)
    relevance = min(96, avg + 2)
    overall = round((communication + technical_depth + confidence + relevance) / 4)

    if overall >= 85:
        verdict = "Strong Hire"
    elif overall >= 72:
        verdict = "Hire"
    elif overall >= 58:
        verdict = "Leaning Hire"
    else:
        verdict = "Developing"

    return {
        "overall_score": overall,
        "dimensions": {
            "communication": communication,
            "technical_depth": technical_depth,
            "confidence": confidence,
            "relevance": relevance,
        },
        "verdict": verdict,
        "summary": (
            f"Demo evaluation for {experience_level} {role} ({interview_type}): "
            f"You completed {len(turns_history)} interview turns with an overall readiness score of {overall}/100. "
            "Focus on pairing clear STAR/system-design structure with quantified outcomes."
        ),
        "strengths": [
            "Maintained clear relevance to the prompt and role expectations.",
            "Engaged constructively with follow-up probing.",
            "Paced responses steadily within the per-question timer window.",
        ],
        "weak_areas": [
            "Include more explicit quantitative outcomes (latency, conversion, error rate, or time saved).",
            "Call out rejected alternatives and architectural/process trade-offs upfront.",
        ],
        "question_breakdown": breakdown,
    }
