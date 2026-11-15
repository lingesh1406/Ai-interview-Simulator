export const APPENDIX_CODE_MODELS = `# Excerpt from backend/models.py
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(64), primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    sessions = db.relationship("InterviewSession", backref="user", lazy=True, cascade="all, delete-orphan")

class InterviewSession(db.Model):
    __tablename__ = "interview_sessions"
    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    role = db.Column(db.String(160), nullable=False)
    experience_level = db.Column(db.String(32), nullable=False)
    interview_type = db.Column(db.String(32), nullable=False)
    total_questions = db.Column(db.Integer, nullable=False, default=5)
    seconds_per_question = db.Column(db.Integer, nullable=False, default=120)
    current_question_index = db.Column(db.Integer, nullable=False, default=1)
    resume_text = db.Column(db.Text, nullable=True)
    job_description = db.Column(db.Text, nullable=True)
    demo_mode = db.Column(db.Boolean, nullable=False, default=False)
    status = db.Column(db.String(24), nullable=False, default="in_progress")`;

export const APPENDIX_CODE_AUTH = `# Excerpt from backend/app.py
def _create_auth_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    sig = hmac.new(_get_auth_secret(), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{encoded}.{sig}"

def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
        user_id = _verify_auth_token(token)
        if not user_id:
            return jsonify({"error": "Authentication required. Please sign in."}), 401
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User account not found. Please sign in again."}), 401
        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper`;

export const APPENDIX_CODE_AI_SERVICE = `# Excerpt from backend/ai_service.py
def extract_json_object(raw_text: str) -> dict[str, Any]:
    """Safely parse JSON from model output even if wrapped in prose or code fences."""
    cleaned = raw_text.strip()
    if cleaned.startswith("\`\`\`"):
        cleaned = re.sub(r"^\`\`\`(?:json)?\\s*", "", cleaned)
        cleaned = re.sub(r"\\s*\`\`\`$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\\{[\\s\\S]*\\}", cleaned)
    if not match:
        raise ValueError("Model response did not contain a valid JSON object.")
    return json.loads(match.group(0))`;

export const APPENDIX_CODE_PROTECTED_ROUTE = `// Excerpt from src/components/ProtectedRoute.jsx
import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';

export function ProtectedRoute({ user, isCheckingAuth, notice, children }) {
  const location = useLocation();
  if (isCheckingAuth) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center py-20 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
        Verifying session...
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          authNotice: notice || 'Please sign in or register to access your live interview session.',
        }}
      />
    );
  }
  return children;
}`;

export const APPENDIX_CODE_VOICE = `// Excerpt from src/components/VoiceControls.jsx
const speakText = useCallback((text) => {
  if (!ttsSupported || isMuted || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.onstart = () => setIsSpeaking(true);
  utterance.onend = () => setIsSpeaking(false);
  utterance.onerror = () => setIsSpeaking(false);
  window.speechSynthesis.speak(utterance);
}, [isMuted, ttsSupported]);`;
