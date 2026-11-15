function SvgBox({ x, y, w, h, title, subtitle, fill = '#f8fafc', dashed = false }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="4"
        fill={fill}
        stroke="#1e293b"
        strokeWidth="1.25"
        strokeDasharray={dashed ? '5,4' : undefined}
      />
      <text
        x={x + w / 2}
        y={subtitle ? y + h / 2 - 5 : y + h / 2 + 4}
        textAnchor="middle"
        fontFamily="Times New Roman, Times, serif"
        fontSize="11.5"
        fontWeight="bold"
        fill="#0f172a"
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 11}
          textAnchor="middle"
          fontFamily="Times New Roman, Times, serif"
          fontSize="10"
          fill="#334155"
        >
          {subtitle}
        </text>
      )}
    </g>
  );
}

function ArrowDefs() {
  return (
    <defs>
      <marker
        id="arrow-dark"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e293b" />
      </marker>
    </defs>
  );
}

export function Figure1Methodology() {
  return (
    <svg viewBox="0 0 680 120" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Methodology flowchart">
      <ArrowDefs />
      <SvgBox x={10} y={30} w={110} h={56} title="1. Requirement" subtitle="Analysis & Setup" />
      <line x1={120} y1={58} x2={145} y2={58} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <SvgBox x={147} y={30} w={112} h={56} title="2. System" subtitle="Architecture & DB" />
      <line x1={259} y1={58} x2={284} y2={58} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <SvgBox x={286} y={30} w={118} h={56} title="3. AI & Speech" subtitle="Integration" />
      <line x1={404} y1={58} x2={429} y2={58} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <SvgBox x={431} y={30} w={112} h={56} title="4. Protected UI" subtitle="& Testing" />
      <line x1={543} y1={58} x2={568} y2={58} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <SvgBox x={570} y={30} w={100} h={56} title="5. Evaluation" subtitle="& Deployment" />
    </svg>
  );
}

export function Figure3ProposedConcept() {
  return (
    <svg viewBox="0 0 680 210" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Proposed system concept diagram">
      <ArrowDefs />
      <SvgBox x={20} y={72} w={128} h={64} title="Candidate" subtitle="Resume / Voice / Text" />
      <line x1={148} y1={104} x2={195} y2={104} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />

      <SvgBox x={198} y={24} w={250} h={46} title="Auth & Protected Route Guard" subtitle="HMAC Bearer Token + Role Config" fill="#f1f5f9" />
      <SvgBox x={198} y={82} w={250} h={50} title="Adaptive AI Interview Engine" subtitle="Anthropic Claude API / Demo Mode" fill="#f1f5f9" />
      <SvgBox x={198} y={144} w={250} h={46} title="SQLite / SQLAlchemy Persistence" subtitle="Users, Sessions, Turns & Reports" fill="#f1f5f9" />

      <line x1={323} y1={70} x2={323} y2={82} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <line x1={323} y1={132} x2={323} y2={144} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />

      <line x1={448} y1={104} x2={498} y2={104} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <SvgBox x={500} y={56} w={160} h={96} title="Evaluation & Growth" subtitle="4-Dimension Scores, Model Answers & Trend Chart" />
    </svg>
  );
}

export function Figure4SystemArchitecture() {
  return (
    <svg viewBox="0 0 680 310" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Four-layer system architecture">
      <ArrowDefs />
      {/* Layer 1 */}
      <rect x={20} y={12} width={640} height={60} rx="5" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.3" />
      <text x={32} y={31} fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold" fill="#0f172a">
        Layer 1: Presentation Layer (React 19 JSX + Vite + Tailwind CSS v4)
      </text>
      <text x={32} y={52} fontFamily="Times New Roman, Times, serif" fontSize="10.5" fill="#334155">
        AuthForm | SetupForm | ProtectedRoute | ChatInterview | Timer | VoiceControls (TTS/STT) | ReportCard | HistoryChart
      </text>

      <line x1={340} y1={72} x2={340} y2={92} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />

      {/* Layer 2 */}
      <rect x={20} y={94} width={640} height={58} rx="5" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.3" />
      <text x={32} y={113} fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold" fill="#0f172a">
        Layer 2: API & Security Layer (Flask REST API / Express Proxy)
      </text>
      <text x={32} y={134} fontFamily="Times New Roman, Times, serif" fontSize="10.5" fill="#334155">
        CORS Policy | Salted Password Hashing | HMAC-SHA256 Bearer Verification (@require_auth) | Input Validation
      </text>

      <line x1={340} y1={152} x2={340} y2={172} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />

      {/* Layer 3 */}
      <rect x={20} y={174} width={640} height={58} rx="5" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.3" />
      <text x={32} y={193} fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold" fill="#0f172a">
        Layer 3: Application Logic & Intelligence Layer
      </text>
      <text x={32} y={214} fontFamily="Times New Roman, Times, serif" fontSize="10.5" fill="#334155">
        Anthropic Claude SDK (ANTHROPIC_MODEL) | Safe JSON Parser | Follow-up Decision Engine | Demo Mode | PDF Parser (pypdf/unpdf)
      </text>

      <line x1={340} y1={232} x2={340} y2={252} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />

      {/* Layer 4 */}
      <rect x={20} y={254} width={640} height={46} rx="5" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.3" />
      <text x={32} y={272} fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold" fill="#0f172a">
        Layer 4: Data Persistence Layer (SQLAlchemy ORM + SQLite)
      </text>
      <text x={32} y={290} fontFamily="Times New Roman, Times, serif" fontSize="10.5" fill="#334155">
        Tables: users | interview_sessions | interview_turns | interview_reports
      </text>
    </svg>
  );
}

export function Figure4ModuleInteraction() {
  return (
    <svg viewBox="0 0 680 220" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Module interaction diagram">
      <ArrowDefs />
      <SvgBox x={20} y={20} w={140} h={52} title="Authentication" subtitle="/api/auth/*" />
      <SvgBox x={190} y={20} w={140} h={52} title="Setup & Resume" subtitle="/api/resume/parse" />
      <SvgBox x={360} y={20} w={140} h={52} title="Live Interview" subtitle="/api/interview/*" />
      <SvgBox x={530} y={20} w={130} h={52} title="History & Analytics" subtitle="/api/history" />

      <line x1={160} y1={46} x2={188} y2={46} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <line x1={330} y1={46} x2={358} y2={46} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <line x1={500} y1={46} x2={528} y2={46} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />

      <SvgBox x={150} y={132} w={175} h={58} title="AI Interviewer Service" subtitle="Questioning, Follow-up & Scoring" fill="#f1f5f9" />
      <SvgBox x={365} y={132} w={175} h={58} title="SQLite Data Repository" subtitle="ACID Session & Report Storage" fill="#f1f5f9" />

      <line x1={430} y1={72} x2={265} y2={130} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <line x1={430} y1={72} x2={445} y2={130} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <line x1={595} y1={72} x2={495} y2={130} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <line x1={325} y1={161} x2={363} y2={161} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
    </svg>
  );
}

export function Figure4DataFlow() {
  const steps = [
    '1. Register / Login',
    '2. Configure Role & Type',
    '3. Upload PDF Resume',
    '4. Start Session API',
    '5. Read Prompt (TTS)',
    '6. Answer (Text / STT)',
    '7. Adaptive Follow-up',
    '8. Complete All Turns',
    '9. Generate Report',
    '10. Save to History Chart',
  ];
  return (
    <svg viewBox="0 0 680 185" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Ten-stage data flow diagram">
      <ArrowDefs />
      {steps.slice(0, 5).map((label, idx) => {
        const x = 12 + idx * 134;
        return (
          <g key={label}>
            <SvgBox x={x} y={18} w={118} h={46} title={label} />
            {idx < 4 && (
              <line x1={x + 118} y1={41} x2={x + 132} y2={41} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
            )}
          </g>
        );
      })}
      <path d="M 607 64 L 607 88 L 71 88 L 71 108" fill="none" stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      {steps.slice(5).map((label, idx) => {
        const x = 12 + idx * 134;
        return (
          <g key={label}>
            <SvgBox x={x} y={110} w={118} h={46} title={label} />
            {idx < 4 && (
              <line x1={x + 118} y1={133} x2={x + 132} y2={133} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Figure4UseCase() {
  return (
    <svg viewBox="0 0 680 280" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Use case diagram">
      {/* System boundary */}
      <rect x={150} y={14} width={380} height={252} rx="6" fill="#ffffff" stroke="#1e293b" strokeWidth="1.4" />
      <text x={340} y={33} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="12" fontWeight="bold" fill="#0f172a">
        AI Interview Simulator System
      </text>

      {/* Candidate Actor */}
      <circle cx={65} cy={100} r="14" fill="none" stroke="#1e293b" strokeWidth="1.5" />
      <line x1={65} y1={114} x2={65} y2={156} stroke="#1e293b" strokeWidth="1.5" />
      <line x1={42} y1={130} x2={88} y2={130} stroke="#1e293b" strokeWidth="1.5" />
      <line x1={65} y1={156} x2={46} y2={186} stroke="#1e293b" strokeWidth="1.5" />
      <line x1={65} y1={156} x2={84} y2={186} stroke="#1e293b" strokeWidth="1.5" />
      <text x={65} y={205} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold">
        Candidate
      </text>

      {/* AI Engine Actor */}
      <rect x={560} y={115} width={104} height={46} rx="4" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.4" />
      <text x={612} y={135} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="11" fontWeight="bold">
        Anthropic LLM /
      </text>
      <text x={612} y={150} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="10.5">
        Demo Service
      </text>

      {/* Use Cases */}
      {[
        { y: 58, label: 'Register & Sign In' },
        { y: 98, label: 'Configure Interview & Upload PDF' },
        { y: 138, label: 'Participate in Live Voice/Text Session' },
        { y: 178, label: 'Answer Adaptive Follow-up Probes' },
        { y: 218, label: 'Review Report & History Trend Chart' },
      ].map((uc) => (
        <g key={uc.label}>
          <ellipse cx={340} cy={uc.y} rx={152} ry={16} fill="#f8fafc" stroke="#1e293b" strokeWidth="1.15" />
          <text x={340} y={uc.y + 4} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="10.5">
            {uc.label}
          </text>
          <line x1={90} y1={134} x2={188} y2={uc.y} stroke="#475569" strokeWidth="1" />
        </g>
      ))}
      <line x1={492} y1={138} x2={560} y2={138} stroke="#475569" strokeWidth="1" />
      <line x1={492} y1={178} x2={560} y2={144} stroke="#475569" strokeWidth="1" />
      <line x1={492} y1={218} x2={560} y2={150} stroke="#475569" strokeWidth="1" />
    </svg>
  );
}

export function Figure4ErDiagram() {
  return (
    <svg viewBox="0 0 680 250" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Logical entity relationship diagram">
      <ArrowDefs />
      {/* users */}
      <rect x={16} y={24} width={150} height={116} rx="3" fill="#ffffff" stroke="#1e293b" strokeWidth="1.3" />
      <rect x={16} y={24} width={150} height={24} fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.3" />
      <text x={91} y={40} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold">users</text>
      <text x={24} y={64} fontFamily="Times New Roman, Times, serif" fontSize="10">PK  id (UUID)</text>
      <text x={24} y={81} fontFamily="Times New Roman, Times, serif" fontSize="10">    full_name</text>
      <text x={24} y={98} fontFamily="Times New Roman, Times, serif" fontSize="10">UQ  email</text>
      <text x={24} y={115} fontFamily="Times New Roman, Times, serif" fontSize="10">    password_hash</text>
      <text x={24} y={132} fontFamily="Times New Roman, Times, serif" fontSize="10">    created_at</text>

      {/* interview_sessions */}
      <rect x={228} y={16} width={190} height={162} rx="3" fill="#ffffff" stroke="#1e293b" strokeWidth="1.3" />
      <rect x={228} y={16} width={190} height={24} fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.3" />
      <text x={323} y={32} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold">interview_sessions</text>
      <text x={236} y={56} fontFamily="Times New Roman, Times, serif" fontSize="10">PK  id (UUID)</text>
      <text x={236} y={72} fontFamily="Times New Roman, Times, serif" fontSize="10">FK  user_id</text>
      <text x={236} y={88} fontFamily="Times New Roman, Times, serif" fontSize="10">    role, experience_level</text>
      <text x={236} y={104} fontFamily="Times New Roman, Times, serif" fontSize="10">    interview_type, total_questions</text>
      <text x={236} y={120} fontFamily="Times New Roman, Times, serif" fontSize="10">    seconds_per_question</text>
      <text x={236} y={136} fontFamily="Times New Roman, Times, serif" fontSize="10">    resume_text, job_description</text>
      <text x={236} y={152} fontFamily="Times New Roman, Times, serif" fontSize="10">    demo_mode, status</text>
      <text x={236} y={168} fontFamily="Times New Roman, Times, serif" fontSize="10">    created_at, completed_at</text>

      {/* interview_turns */}
      <rect x={480} y={14} width={184} height={120} rx="3" fill="#ffffff" stroke="#1e293b" strokeWidth="1.3" />
      <rect x={480} y={14} width={184} height={24} fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.3" />
      <text x={572} y={30} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold">interview_turns</text>
      <text x={488} y={54} fontFamily="Times New Roman, Times, serif" fontSize="10">PK  id (Integer)</text>
      <text x={488} y={70} fontFamily="Times New Roman, Times, serif" fontSize="10">FK  session_id</text>
      <text x={488} y={86} fontFamily="Times New Roman, Times, serif" fontSize="10">    sequence_number, is_followup</text>
      <text x={488} y={102} fontFamily="Times New Roman, Times, serif" fontSize="10">    question_text, answer_text</text>
      <text x={488} y={118} fontFamily="Times New Roman, Times, serif" fontSize="10">    duration_seconds, transition</text>

      {/* interview_reports */}
      <rect x={480} y={148} width={184} height={92} rx="3" fill="#ffffff" stroke="#1e293b" strokeWidth="1.3" />
      <rect x={480} y={148} width={184} height={22} fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.3" />
      <text x={572} y={163} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="11.5" fontWeight="bold">interview_reports</text>
      <text x={488} y={184} fontFamily="Times New Roman, Times, serif" fontSize="10">PK  id | FK session_id (UQ)</text>
      <text x={488} y={200} fontFamily="Times New Roman, Times, serif" fontSize="10">    overall, comm, tech, conf, rel</text>
      <text x={488} y={216} fontFamily="Times New Roman, Times, serif" fontSize="10">    verdict, summary</text>
      <text x={488} y={232} fontFamily="Times New Roman, Times, serif" fontSize="10">    strengths, weak_areas, breakdown</text>

      {/* Relationships */}
      <line x1={166} y1={82} x2={228} y2={82} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <text x={197} y={75} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="9.5">1 : N</text>

      <line x1={418} y1={72} x2={480} y2={72} stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <text x={449} y={65} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="9.5">1 : N</text>

      <path d="M 418 148 L 448 148 L 448 194 L 480 194" fill="none" stroke="#1e293b" strokeWidth="1.3" markerEnd="url(#arrow-dark)" />
      <text x={449} y={185} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="9.5">1 : 1</text>
    </svg>
  );
}

export function Figure4Sequence() {
  const cols = [
    { x: 75, label: 'Candidate UI' },
    { x: 245, label: 'ProtectedRoute / API' },
    { x: 425, label: 'AI Interview Service' },
    { x: 595, label: 'SQLite DB' },
  ];
  return (
    <svg viewBox="0 0 680 280" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Sequence diagram for answer submission and evaluation">
      <ArrowDefs />
      {cols.map((c) => (
        <g key={c.label}>
          <rect x={c.x - 62} y={14} width={124} height={30} rx="3" fill="#f1f5f9" stroke="#1e293b" strokeWidth="1.2" />
          <text x={c.x} y={33} textAnchor="middle" fontFamily="Times New Roman, Times, serif" fontSize="10.5" fontWeight="bold">
            {c.label}
          </text>
          <line x1={c.x} y1={44} x2={c.x} y2={266} stroke="#64748b" strokeWidth="1.1" strokeDasharray="4,4" />
        </g>
      ))}

      {/* Messages */}
      {[
        { y: 74, x1: 75, x2: 245, text: '1. POST /api/interview/start (Bearer Token)' },
        { y: 102, x1: 245, x2: 425, text: '2. generate_opening_question()' },
        { y: 128, x1: 245, x2: 595, text: '3. INSERT session & turn 1' },
        { y: 156, x1: 245, x2: 75, text: '4. Question 1 (TTS spoken)' },
        { y: 184, x1: 75, x2: 245, text: '5. POST /api/interview/answer' },
        { y: 212, x1: 245, x2: 425, text: '6. process_candidate_answer()' },
        { y: 238, x1: 425, x2: 245, text: '7. ask_followup | next_question | complete' },
        { y: 260, x1: 245, x2: 75, text: '8. Render next prompt or Final Report' },
      ].map((m) => (
        <g key={m.y}>
          <line x1={m.x1} y1={m.y} x2={m.x2} y2={m.y} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
          <text
            x={(m.x1 + m.x2) / 2}
            y={m.y - 5}
            textAnchor="middle"
            fontFamily="Times New Roman, Times, serif"
            fontSize="9.5"
            fill="#0f172a"
          >
            {m.text}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Figure5ResumePipeline() {
  return (
    <svg viewBox="0 0 680 110" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Resume extraction pipeline">
      <ArrowDefs />
      <SvgBox x={12} y={26} w={116} h={52} title="PDF Upload" subtitle="Max 5 MB" />
      <line x1={128} y1={52} x2={152} y2={52} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={154} y={26} w={122} h={52} title="Header & Size" subtitle="Validation" />
      <line x1={276} y1={52} x2={300} y2={52} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={302} y={26} w={122} h={52} title="Text Extraction" subtitle="pypdf / unpdf" />
      <line x1={424} y1={52} x2={448} y2={52} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={450} y={26} w={104} h={52} title="Truncation" subtitle="<= 6,000 chars" />
      <line x1={554} y1={52} x2={578} y2={52} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={580} y={26} w={88} h={52} title="Prompt" subtitle="Context" />
    </svg>
  );
}

export function Figure5ScoringPipeline() {
  return (
    <svg viewBox="0 0 680 120" className="w-full max-w-[640px] mx-auto block" role="img" aria-label="Scoring and report generation pipeline">
      <ArrowDefs />
      <SvgBox x={10} y={30} w={120} h={56} title="Full Transcript" subtitle="Turns + Timings" />
      <line x1={130} y1={58} x2={154} y2={58} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={156} y={30} w={126} h={56} title="Claude / Demo" subtitle="Rubric Evaluator" />
      <line x1={282} y1={58} x2={306} y2={58} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={308} y={30} w={118} h={56} title="Safe JSON" subtitle="Parse & Clamp" />
      <line x1={426} y1={58} x2={450} y2={58} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={452} y={30} w={104} h={56} title="Model Answers" subtitle="& Feedback" />
      <line x1={556} y1={58} x2={580} y2={58} stroke="#1e293b" strokeWidth="1.2" markerEnd="url(#arrow-dark)" />
      <SvgBox x={582} y={30} w={88} h={56} title="SQLite" subtitle="Report Row" />
    </svg>
  );
}
