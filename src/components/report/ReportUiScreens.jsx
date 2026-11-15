export function Figure7AuthScreen() {
  return (
    <div className="mx-auto max-w-[560px] border border-slate-700 bg-white text-slate-900 font-sans text-[11px] leading-snug">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold">
        <span>AI Interview Simulator</span>
        <span className="text-slate-600">Setup | Live Session | History</span>
        <span className="border border-slate-400 px-1.5 py-0.5">Sign In</span>
      </div>
      <div className="p-5">
        <div className="mx-auto max-w-[320px] border border-slate-300 p-4 bg-slate-50">
          <div className="grid grid-cols-2 border border-slate-300 bg-white mb-3 text-center font-bold">
            <div className="bg-slate-800 text-white py-1">Sign In</div>
            <div className="py-1 text-slate-700">Create Account</div>
          </div>
          <div className="font-bold text-[12px] mb-1">Sign in to your account</div>
          <div className="text-[10px] text-slate-600 mb-3">
            Access protected live interview sessions, evaluations, and score history.
          </div>
          <div className="space-y-2">
            <div>
              <div className="font-semibold text-[10px]">Email Address</div>
              <div className="border border-slate-300 bg-white px-2 py-1 text-slate-500">candidate@example.com</div>
            </div>
            <div>
              <div className="font-semibold text-[10px]">Password</div>
              <div className="border border-slate-300 bg-white px-2 py-1 text-slate-500">••••••••••••</div>
            </div>
            <div className="bg-slate-800 text-white text-center font-bold py-1.5 mt-2">
              Sign In &amp; Continue
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Figure7SetupScreen() {
  return (
    <div className="mx-auto max-w-[580px] border border-slate-700 bg-white text-slate-900 font-sans text-[10.5px] leading-snug">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold">
        <span>AI Interview Simulator</span>
        <span>Setup (Active) | Live Session | History</span>
        <span>Candidate Profile | Sign Out</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2 border border-slate-300 p-3">
          <div className="font-bold text-[12px]">Configure Practice Interview</div>
          <div>
            <div className="font-semibold">Target Job Role</div>
            <div className="border border-slate-300 px-2 py-1 bg-slate-50">Full-Stack Software Engineer</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="font-semibold">Experience Level</div>
              <div className="border border-slate-300 px-2 py-1">Junior (Selected)</div>
            </div>
            <div>
              <div className="font-semibold">Interview Type</div>
              <div className="border border-slate-300 px-2 py-1">Mixed (HR + Tech)</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="font-semibold">Question Count (5–10)</div>
              <div className="border border-slate-300 px-2 py-1">6 Core Questions</div>
            </div>
            <div>
              <div className="font-semibold">Timer Pace</div>
              <div className="border border-slate-300 px-2 py-1">120s / Question</div>
            </div>
          </div>
          <div>
            <div className="font-semibold">Job Description (Optional)</div>
            <div className="border border-slate-300 px-2 py-2 text-slate-500">
              React, Python Flask, REST APIs, SQLite database design...
            </div>
          </div>
        </div>
        <div className="space-y-2 border border-slate-300 p-3 bg-slate-50 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="font-bold text-[11px]">Optional PDF Resume</div>
            <div className="border border-dashed border-slate-400 bg-white p-2 text-center text-[10px]">
              Upload PDF (&lt; 5 MB)
              <div className="mt-1 font-semibold text-slate-700">Parsed: 2 pages, 1,840 chars</div>
            </div>
            <div className="text-[10px] text-slate-600">
              Resume context tailors questions directly to candidate projects.
            </div>
          </div>
          <div className="bg-slate-800 text-white text-center font-bold py-1.5">
            Start Live Interview →
          </div>
        </div>
      </div>
    </div>
  );
}

export function Figure7LiveInterviewScreen() {
  return (
    <div className="mx-auto max-w-[580px] border border-slate-700 bg-white text-slate-900 font-sans text-[10.5px] leading-snug">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold">
        <span>Live Session — Protected Route</span>
        <span>Full-Stack Software Engineer · Junior · Mixed</span>
        <span className="border border-slate-400 px-1.5 py-0.5">End Early</span>
      </div>
      <div className="p-3 grid grid-cols-3 gap-3">
        <div className="col-span-2 border border-slate-300 p-3 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[10px] border-b border-slate-200 pb-1">
            <span className="font-bold">Question 2 of 6</span>
            <span>Progress: 33%</span>
          </div>
          <div className="space-y-2">
            <div className="border border-slate-300 bg-slate-50 p-2">
              <div className="font-bold text-[10px] text-slate-700">AI Interviewer</div>
              <div>Tell me about a project you worked on recently and how you tested it.</div>
            </div>
            <div className="border border-slate-400 bg-white p-2 ml-6">
              <div className="font-bold text-[10px] text-slate-700">Candidate</div>
              <div>I built a React and Flask portal with automated validation and API checks...</div>
            </div>
            <div className="border border-slate-300 bg-slate-50 p-2">
              <div className="font-bold text-[10px] text-slate-700">AI Interviewer · Follow-up</div>
              <div>Got it. What specific edge case caused the biggest bug during testing?</div>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-2 flex gap-2">
            <div className="flex-1 border border-slate-300 px-2 py-1 text-slate-500">
              Type or dictate your response...
            </div>
            <div className="bg-slate-800 text-white px-3 py-1 font-bold">Submit Answer</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="border border-slate-300 p-2.5 bg-slate-50 text-center">
            <div className="text-[10px] font-semibold text-slate-600">Question Timer</div>
            <div className="text-[18px] font-bold tracking-tight my-1">01:42</div>
            <div className="w-full h-1.5 bg-slate-200">
              <div className="w-4/5 h-1.5 bg-slate-800" />
            </div>
          </div>
          <div className="border border-slate-300 p-2.5 space-y-1.5">
            <div className="text-[10px] font-bold">Voice Controls (Web Speech)</div>
            <div className="grid grid-cols-2 gap-1 text-center text-[9.5px]">
              <div className="border border-slate-300 py-1 bg-white">Mute Voice</div>
              <div className="border border-slate-300 py-1 bg-white">Replay</div>
            </div>
            <div className="border border-slate-700 bg-slate-800 text-white text-center py-1 font-bold">
              Answer by Voice (Mic)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Figure7ReportScreen() {
  return (
    <div className="mx-auto max-w-[580px] border border-slate-700 bg-white text-slate-900 font-sans text-[10.5px] leading-snug">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold">
        <span>Evaluation Report Card</span>
        <span>Verdict: Hire (84 / 100)</span>
        <span>View History | New Interview</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="border border-slate-800 bg-slate-800 text-white p-2">
            <div className="text-[9px]">Overall Score</div>
            <div className="text-[16px] font-bold">84/100</div>
          </div>
          <div className="border border-slate-300 p-2">
            <div className="text-[9px] text-slate-600">Communication</div>
            <div className="text-[13px] font-bold">86</div>
          </div>
          <div className="border border-slate-300 p-2">
            <div className="text-[9px] text-slate-600">Tech Depth</div>
            <div className="text-[13px] font-bold">81</div>
          </div>
          <div className="border border-slate-300 p-2">
            <div className="text-[9px] text-slate-600">Confidence</div>
            <div className="text-[13px] font-bold">85</div>
          </div>
          <div className="border border-slate-300 p-2">
            <div className="text-[9px] text-slate-600">Relevance</div>
            <div className="text-[13px] font-bold">84</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-slate-300 p-2 bg-slate-50">
            <div className="font-bold text-[10px]">Key Strengths</div>
            <div>• Structured STAR framing and clear trade-off explanation.</div>
          </div>
          <div className="border border-slate-300 p-2 bg-slate-50">
            <div className="font-bold text-[10px]">Areas to Improve</div>
            <div>• Add concrete latency/throughput metrics to answers.</div>
          </div>
        </div>
        <div className="border border-slate-300 p-2">
          <div className="font-bold text-[10px] mb-1">Per-Question Breakdown &amp; Model Answer (Q1)</div>
          <div className="text-[10px]"><strong>Critique (85/100):</strong> Clear explanation of REST validation and state updates.</div>
          <div className="text-[10px] text-slate-700 mt-0.5"><strong>Model Answer:</strong> Frame context, architecture decision, edge-case handling, and measurable impact.</div>
        </div>
      </div>
    </div>
  );
}

export function Figure7HistoryScreen() {
  return (
    <div className="mx-auto max-w-[580px] border border-slate-700 bg-white text-slate-900 font-sans text-[10.5px] leading-snug">
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-[10px] font-bold">
        <span>Interview History &amp; Score Trend</span>
        <span>Protected Analytics View</span>
        <span>Filter: All Types</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="border border-slate-300 p-1.5"><div className="text-[9px] text-slate-600">Completed</div><div className="font-bold">6 Sessions</div></div>
          <div className="border border-slate-300 p-1.5"><div className="text-[9px] text-slate-600">Average Score</div><div className="font-bold">78.5</div></div>
          <div className="border border-slate-300 p-1.5"><div className="text-[9px] text-slate-600">Best Score</div><div className="font-bold">88</div></div>
          <div className="border border-slate-300 p-1.5"><div className="text-[9px] text-slate-600">Trend</div><div className="font-bold">+12 pts</div></div>
        </div>
        <div className="border border-slate-300 p-2 bg-slate-50">
          <div className="font-bold text-[10px] mb-1">Score Progress Over Time</div>
          <svg viewBox="0 0 460 72" className="w-full h-14 block">
            <line x1="28" y1="10" x2="28" y2="58" stroke="#64748b" strokeWidth="1" />
            <line x1="28" y1="58" x2="440" y2="58" stroke="#64748b" strokeWidth="1" />
            <polyline fill="none" stroke="#0f172a" strokeWidth="2" points="48,46 124,40 200,34 276,28 352,20 424,14" />
            {[
              [48, 46],
              [124, 40],
              [200, 34],
              [276, 28],
              [352, 20],
              [424, 14],
            ].map(([cx, cy], idx) => (
              <circle key={idx} cx={cx} cy={cy} r="3.5" fill="#0f172a" />
            ))}
          </svg>
        </div>
        <div className="border border-slate-300 text-[9.5px]">
          <div className="grid grid-cols-4 bg-slate-100 font-bold px-2 py-1 border-b border-slate-300">
            <span>Role</span><span>Type</span><span>Score</span><span>Verdict</span>
          </div>
          <div className="grid grid-cols-4 px-2 py-1 border-b border-slate-200">
            <span>Full-Stack Engineer</span><span>Mixed</span><span>84 / 100</span><span>Hire</span>
          </div>
          <div className="grid grid-cols-4 px-2 py-1">
            <span>Backend Developer</span><span>Technical</span><span>88 / 100</span><span>Strong Hire</span>
          </div>
        </div>
      </div>
    </div>
  );
}
