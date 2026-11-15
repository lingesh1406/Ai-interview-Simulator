# AI Interview Simulator

A full-stack realistic job interview simulator built with **React (Vite + TypeScript + Tailwind CSS)** on the frontend and **Python (Flask + SQLAlchemy + SQLite + Anthropic API)** on the backend, including a built-in Node/SQLite runtime adapter for single-command previews and a zero-key **Demo Mode**.

---

## Project Structure

```text
├── backend/
│   ├── app.py                # Flask REST API (/api/interview/*, /api/history, /api/resume/parse)
│   ├── ai_service.py         # Anthropic SDK integration + structured JSON parsing + Demo Mode
│   ├── models.py             # SQLAlchemy ORM models (InterviewSession, InterviewTurn, InterviewReport)
│   ├── resume_parser.py      # PDF resume extraction via pypdf
│   └── requirements.txt      # Python backend dependencies
├── src/
│   ├── components/
│   │   ├── AuthForm.jsx      # Sign In & Create Account authentication flow (/login, /register)
│   │   ├── ProtectedRoute.jsx# Route guard protecting /live-session, /report, and /history
│   │   ├── SetupForm.jsx     # Role, level, type, question count (5–10), resume PDF upload, JD input
│   │   ├── ChatInterview.jsx # Conversational interview room (/live-session) with adaptive follow-ups
│   │   ├── VoiceControls.jsx # Browser Speech-to-Text dictation & Text-to-Speech question playback
│   │   ├── Timer.jsx         # Non-stressful per-question countdown timer
│   │   ├── ReportCard.jsx    # Overall score, 4 competency bars, strengths/weak areas, model answers
│   │   └── HistoryChart.jsx  # Interactive SVG progress chart & past sessions table
│   ├── services/
│   │   └── api.js            # Typed-safe REST API client with Bearer token auth
│   ├── App.jsx               # App shell, navigation, auth state, and light/dark theme state
│   ├── main.jsx              # React root entry point
│   └── index.css             # Tailwind v4 configuration & typography variables
├── server.ts                 # Full-stack Express + Vite dev server (with optional Flask proxy)
├── .env.example              # Environment variable template
└── package.json              # Frontend & Node runtime dependencies/scripts
```

---

## Main Features

1. **Candidate Accounts & Authentication (`AuthForm`)**
   - Secure registration (`POST /api/auth/register`) and login (`POST /api/auth/login`) with salted password hashing and signed session tokens.
   - All interview sessions, reports, and score charts are scoped privately to the signed-in user.
2. **Configurable Interview Setup (`SetupForm`)**
   - Target job role (with quick role presets), experience level (`Intern`, `Junior`, `Mid`, `Senior`), interview type (`HR`, `Technical`, `Behavioral`, `Mixed`), question count (`5`–`10`), and target pace per question.
   - Optional **PDF Resume upload** (`POST /api/resume/parse`) and **Job Description** paste to tailor questions.
3. **Realistic Chat Interview & Adaptive Follow-ups (`ChatInterview`)**
   - One question at a time in a clean conversational layout.
   - The AI evaluates each response and decides whether to ask a probing follow-up question or acknowledge and advance to the next core question.
4. **Voice Controls (`VoiceControls`)**
   - Reads interviewer questions aloud via browser `speechSynthesis` with a Mute/Unmute toggle and Replay button.
   - Supports hands-free spoken answers via browser `SpeechRecognition` / `webkitSpeechRecognition`.
5. **Non-Stressful Question Timer (`Timer`)**
   - Per-question countdown with tabular numerals and a calm wrap-up cue when the target time elapses.
6. **Comprehensive Evaluation Report (`ReportCard`)**
   - Overall score out of 100 and hiring recommendation.
   - Competency scores for **Communication**, **Technical Depth**, **Confidence**, and **Relevance**.
   - Key strengths, areas to strengthen, and an expandable **per-question breakdown with model answers**.
7. **Persistent History & Progress Chart (`HistoryChart`)**
   - Stores users, sessions, turns, and reports in SQLite (`interview_simulator.db`).
   - Plots score progression over time with metric switching and searchable past reports.
8. **Demo Mode (No API Key Required)**
   - Works out-of-the-box without an `ANTHROPIC_API_KEY`, generating role-tailored questions, adaptive follow-ups, and structured reports.

---

## Setup & Running Locally

### 1. Configure Environment Variables

```bash
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, defaulting to `claude-sonnet-4-20250514`) and `AUTH_SECRET` in `.env`. Leave `ANTHROPIC_API_KEY` blank or set `DEMO_MODE=true` to run in Demo Mode.

### 2. Option A — Run with Python Flask Backend + React (Vite) Frontend

**Start the Flask API (`http://localhost:5000`):**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

**Start the React Frontend (`http://localhost:3000`):**

In `.env`, set `FLASK_BACKEND_URL="http://localhost:5000"` (or `VITE_API_BASE_URL="http://localhost:5000"` when using `npm run dev:vite`), then:

```bash
npm install
npm run dev
```

### 3. Option B — Single-Command Full-Stack Preview (`server.ts`)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The Express + Vite server serves both the React app and the SQLite-backed `/api/*` endpoints directly.

---

## API Reference

- `POST /api/auth/register` — Creates a new user account and returns a signed session token.
- `POST /api/auth/login` — Authenticates an existing user and returns a signed session token.
- `GET /api/auth/me` — Returns the currently authenticated user profile.
- `POST /api/auth/logout` — Ends the active client session.
- `POST /api/resume/parse` — Multipart PDF upload; extracts and normalizes resume text.
- `POST /api/interview/start` — Creates a new interview session in SQLite and returns Question 1.
- `POST /api/interview/answer` — Records candidate answer and returns a follow-up, next question, or completion signal.
- `POST /api/interview/finish` — Evaluates the full transcript and saves the structured final report.
- `GET /api/history` — Returns the authenticated user's completed sessions and scores sorted newest-first.

---

## Future Improvements

- **Live Coding & System Design Canvas**: Add an optional split-pane code editor or architecture whiteboard for technical interviews.
- **Audio Waveform & Tone Pacing Analytics**: Measure words-per-minute and filler-word frequency during voice answers.
- **PDF Report Export**: Allow candidates to export scorecards and model answers as a formatted PDF study guide.
- **Multi-User Authentication**: Add user accounts so candidates can sync interview history across devices.
