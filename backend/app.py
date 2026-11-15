"""
Flask REST API for AI Interview Simulator.
Endpoints:
  POST /api/auth/register
  POST /api/auth/login
  GET  /api/auth/me
  POST /api/auth/logout
  POST /api/interview/start
  POST /api/interview/answer
  POST /api/interview/finish
  GET  /api/history
  GET  /api/history/<session_id>
  POST /api/resume/parse
  GET  /api/health
"""

import base64
from datetime import datetime, timezone
from functools import wraps
import hashlib
import hmac
import json
import os
import re
import time
import uuid

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from ai_service import (
    generate_final_report,
    generate_opening_question,
    is_demo_mode_enabled,
    process_candidate_answer,
)
from models import InterviewReport, InterviewSession, InterviewTurn, User, db
from mongo_store import MongoStore, get_configured_mongo_uri
from resume_parser import parse_pdf_resume

load_dotenv()

VALID_LEVELS = {"Intern", "Junior", "Mid", "Senior"}
VALID_TYPES = {"HR", "Technical", "Behavioral", "Mixed"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60


def _get_auth_secret() -> bytes:
    secret = os.getenv("AUTH_SECRET", "").strip() or "dev-interview-simulator-secret-change-me"
    return secret.encode("utf-8")


def _create_auth_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    sig = hmac.new(_get_auth_secret(), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{encoded}.{sig}"


def _verify_auth_token(token: str) -> str | None:
    if not token or "." not in token:
        return None
    encoded, provided_sig = token.split(".", 1)
    expected_sig = hmac.new(_get_auth_secret(), encoded.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(provided_sig, expected_sig):
        return None
    try:
        padding = "=" * ((4 - len(encoded) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded + padding).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return str(payload.get("sub") or "") or None
    except Exception:
        return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else ""
        user_id = _verify_auth_token(token)
        if not user_id:
            return jsonify({"error": "Authentication required. Please sign in."}), 401
        mongo: MongoStore | None = getattr(g, "mongo_store", None)
        if mongo is not None:
            user = mongo.find_user_by_id(user_id)
        else:
            user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User account not found. Please sign in again."}), 401
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def create_app() -> Flask:
    app = Flask(__name__)

    mongo_uri = get_configured_mongo_uri()
    mongo_store = MongoStore(mongo_uri) if mongo_uri else None

    database_url = os.getenv("DATABASE_URL", "sqlite:///interview_simulator.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024

    cors_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
        if origin.strip()
    ]
    CORS(app, resources={r"/api/*": {"origins": cors_origins or "*"}})

    if mongo_store is None:
        db.init_app(app)
        with app.app_context():
            db.create_all()

    @app.before_request
    def attach_store():
        g.mongo_store = mongo_store

    @app.errorhandler(404)
    def handle_not_found(_err):
        return jsonify({"error": "Endpoint or resource not found."}), 404

    @app.errorhandler(413)
    def handle_too_large(_err):
        return jsonify({"error": "Uploaded file exceeds the 5 MB size limit."}), 413

    @app.errorhandler(500)
    def handle_server_error(err):
        return jsonify({"error": f"Internal server error: {err}"}), 500

    @app.get("/api/health")
    def health_check():
        return jsonify({
            "status": "ok",
            "backend": "flask-mongodb" if mongo_store else "flask",
            "database": "mongodb" if mongo_store else "sqlite",
            "demo_mode": is_demo_mode_enabled(),
        })

    # -----------------------------------------------------------------------
    # Authentication Endpoints
    # -----------------------------------------------------------------------

    @app.post("/api/auth/register")
    def register():
        payload = request.get_json(silent=True) or {}
        full_name = str(payload.get("full_name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if len(full_name) < 2 or len(full_name) > 80:
            return jsonify({"error": "Please enter your full name (2–80 characters)."}), 400
        if not EMAIL_RE.match(email):
            return jsonify({"error": "Please enter a valid email address."}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters long."}), 400

        if mongo_store is not None:
            if mongo_store.find_user_by_email(email):
                return jsonify({"error": "An account with this email already exists."}), 409
            user_doc = mongo_store.create_user({
                "id": str(uuid.uuid4()),
                "full_name": full_name,
                "email": email,
                "password_hash": generate_password_hash(password),
            })
            return jsonify({
                "token": _create_auth_token(user_doc["id"]),
                "user": mongo_store.public_user(user_doc),
            }), 201

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "An account with this email already exists."}), 409

        user = User(
            id=str(uuid.uuid4()),
            full_name=full_name,
            email=email,
            password_hash=generate_password_hash(password),
        )
        db.session.add(user)
        db.session.commit()

        return jsonify({
            "token": _create_auth_token(user.id),
            "user": user.to_dict(),
        }), 201

    @app.post("/api/auth/login")
    def login():
        payload = request.get_json(silent=True) or {}
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not EMAIL_RE.match(email) or not password:
            return jsonify({"error": "Please enter both your email and password."}), 400

        if mongo_store is not None:
            user_doc = mongo_store.find_user_by_email(email)
            if not user_doc or not check_password_hash(user_doc["password_hash"], password):
                return jsonify({"error": "Invalid email or password."}), 401
            return jsonify({
                "token": _create_auth_token(user_doc["id"]),
                "user": mongo_store.public_user(user_doc),
            }), 200

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password."}), 401

        return jsonify({
            "token": _create_auth_token(user.id),
            "user": user.to_dict(),
        }), 200

    @app.get("/api/auth/me")
    @require_auth
    def get_current_user():
        if mongo_store is not None:
            return jsonify({"user": mongo_store.public_user(g.current_user)}), 200
        return jsonify({"user": g.current_user.to_dict()}), 200

    @app.post("/api/auth/logout")
    def logout():
        return jsonify({"ok": True}), 200

    # -----------------------------------------------------------------------
    # Interview & Resume Endpoints
    # -----------------------------------------------------------------------

    @app.post("/api/resume/parse")
    @require_auth
    def parse_resume():
        if "file" not in request.files:
            return jsonify({"error": "Please attach a PDF file under the 'file' form field."}), 400

        uploaded = request.files["file"]
        if not uploaded or not uploaded.filename:
            return jsonify({"error": "No PDF file selected."}), 400

        try:
            parsed = parse_pdf_resume(uploaded.read(), uploaded.filename)
            return jsonify(parsed), 200
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/interview/start")
    @require_auth
    def start_interview():
        payload = request.get_json(silent=True) or {}
        role = str(payload.get("role", "")).strip()
        experience_level = str(payload.get("experience_level", "Mid")).strip()
        interview_type = str(payload.get("interview_type", "Mixed")).strip()
        resume_text = str(payload.get("resume_text") or "").strip() or None
        job_description = str(payload.get("job_description") or "").strip() or None

        try:
            total_questions = int(payload.get("total_questions", 5))
        except (TypeError, ValueError):
            return jsonify({"error": "total_questions must be an integer between 5 and 10."}), 400

        try:
            seconds_per_question = int(payload.get("seconds_per_question", 120))
        except (TypeError, ValueError):
            seconds_per_question = 120

        if len(role) < 2 or len(role) > 120:
            return jsonify({"error": "Please enter a valid job role (2–120 characters)."}), 400
        if experience_level not in VALID_LEVELS:
            return jsonify({"error": f"experience_level must be one of {sorted(VALID_LEVELS)}."}), 400
        if interview_type not in VALID_TYPES:
            return jsonify({"error": f"interview_type must be one of {sorted(VALID_TYPES)}."}), 400
        if total_questions < 5 or total_questions > 10:
            return jsonify({"error": "total_questions must be between 5 and 10."}), 400
        seconds_per_question = max(45, min(300, seconds_per_question))

        demo_mode = is_demo_mode_enabled()
        opening = generate_opening_question(
            role=role,
            experience_level=experience_level,
            interview_type=interview_type,
            total_questions=total_questions,
            resume_text=resume_text,
            job_description=job_description,
        )

        session_id = str(uuid.uuid4())
        if mongo_store is not None:
            s_doc, t_doc = mongo_store.create_session_and_first_turn(
                {
                    "id": session_id,
                    "user_id": g.current_user["id"],
                    "role": role,
                    "experience_level": experience_level,
                    "interview_type": interview_type,
                    "total_questions": total_questions,
                    "seconds_per_question": seconds_per_question,
                    "current_question_index": 1,
                    "resume_text": resume_text,
                    "job_description": job_description,
                    "demo_mode": demo_mode,
                    "status": "in_progress",
                },
                {
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "sequence_number": 1,
                    "question_number": 1,
                    "is_followup": False,
                    "question_text": opening["question"],
                    "answer_text": None,
                    "duration_seconds": None,
                    "interviewer_transition": None,
                },
            )
            return jsonify({
                "session": mongo_store.public_session(s_doc),
                "greeting": opening["greeting"],
                "current_turn": t_doc,
            }), 201

        session = InterviewSession(
            id=session_id,
            user_id=g.current_user.id,
            role=role,
            experience_level=experience_level,
            interview_type=interview_type,
            total_questions=total_questions,
            seconds_per_question=seconds_per_question,
            current_question_index=1,
            resume_text=resume_text,
            job_description=job_description,
            demo_mode=demo_mode,
            status="in_progress",
        )
        first_turn = InterviewTurn(
            session_id=session_id,
            sequence_number=1,
            question_number=1,
            is_followup=False,
            question_text=opening["question"],
        )

        db.session.add(session)
        db.session.add(first_turn)
        db.session.commit()

        return jsonify({
            "session": session.to_dict(),
            "greeting": opening["greeting"],
            "current_turn": first_turn.to_dict(),
        }), 201

    @app.post("/api/interview/answer")
    @require_auth
    def submit_answer():
        payload = request.get_json(silent=True) or {}
        session_id = str(payload.get("session_id", "")).strip()
        answer_text = str(payload.get("answer_text", "")).strip()

        try:
            duration_seconds = int(payload.get("duration_seconds", 0))
        except (TypeError, ValueError):
            duration_seconds = 0

        if not session_id:
            return jsonify({"error": "session_id is required."}), 400
        if not answer_text:
            return jsonify({"error": "Please enter or dictate an answer before submitting."}), 400

        if mongo_store is not None:
            sess_doc = mongo_store.find_session_by_id(session_id)
            if not sess_doc or sess_doc.get("user_id") != g.current_user["id"]:
                return jsonify({"error": "Interview session not found."}), 404
            if sess_doc.get("status") == "completed":
                return jsonify({"error": "This interview session is already completed."}), 400
            turns_history = mongo_store.list_turns_for_session(session_id)
            if not turns_history:
                return jsonify({"error": "Session has no active question."}), 400
            latest = turns_history[-1]
            dur = max(0, duration_seconds)
            mongo_store.update_turn_answer(latest["id"], answer_text, dur)
            latest["answer_text"] = answer_text
            latest["duration_seconds"] = dur
            already_followed_up = any(
                t["question_number"] == latest["question_number"] and t["is_followup"]
                for t in turns_history
            )
            decision = process_candidate_answer(
                role=sess_doc["role"],
                experience_level=sess_doc["experience_level"],
                interview_type=sess_doc["interview_type"],
                total_questions=sess_doc["total_questions"],
                current_question_number=sess_doc["current_question_index"],
                already_followed_up_current=already_followed_up,
                turns_history=turns_history,
                resume_text=sess_doc.get("resume_text"),
                job_description=sess_doc.get("job_description"),
            )
            mongo_store.update_turn_transition(latest["id"], decision["transition"])
            action = decision["action"]
            next_turn = None
            if action == "ask_followup":
                next_turn = mongo_store.create_turn({
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "sequence_number": len(turns_history) + 1,
                    "question_number": sess_doc["current_question_index"],
                    "is_followup": True,
                    "question_text": decision["next_question"],
                    "answer_text": None,
                    "duration_seconds": None,
                    "interviewer_transition": None,
                })
            elif action == "next_question":
                next_idx = sess_doc["current_question_index"] + 1
                sess_doc = mongo_store.increment_session_question_index(session_id, next_idx) or sess_doc
                next_turn = mongo_store.create_turn({
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "sequence_number": len(turns_history) + 1,
                    "question_number": next_idx,
                    "is_followup": False,
                    "question_text": decision["next_question"],
                    "answer_text": None,
                    "duration_seconds": None,
                    "interviewer_transition": None,
                })
            return jsonify({
                "action": action,
                "transition": decision["transition"],
                "session": mongo_store.public_session(sess_doc),
                "next_turn": next_turn,
            }), 200

        session = db.session.get(InterviewSession, session_id)
        if not session or session.user_id != g.current_user.id:
            return jsonify({"error": "Interview session not found."}), 404
        if session.status == "completed":
            return jsonify({"error": "This interview session is already completed."}), 400

        turns = list(session.turns)
        if not turns:
            return jsonify({"error": "Session has no active question."}), 400

        latest_turn = turns[-1]
        latest_turn.answer_text = answer_text
        latest_turn.duration_seconds = max(0, duration_seconds)

        already_followed_up = any(
            t.question_number == latest_turn.question_number and t.is_followup
            for t in turns
        )
        turns_history = [t.to_dict() for t in turns]

        decision = process_candidate_answer(
            role=session.role,
            experience_level=session.experience_level,
            interview_type=session.interview_type,
            total_questions=session.total_questions,
            current_question_number=session.current_question_index,
            already_followed_up_current=already_followed_up,
            turns_history=turns_history,
            resume_text=session.resume_text,
            job_description=session.job_description,
        )

        latest_turn.interviewer_transition = decision["transition"]
        action = decision["action"]
        next_turn = None

        if action == "ask_followup":
            next_turn = InterviewTurn(
                session_id=session.id,
                sequence_number=len(turns) + 1,
                question_number=session.current_question_index,
                is_followup=True,
                question_text=decision["next_question"],
            )
            db.session.add(next_turn)
        elif action == "next_question":
            session.current_question_index += 1
            next_turn = InterviewTurn(
                session_id=session.id,
                sequence_number=len(turns) + 1,
                question_number=session.current_question_index,
                is_followup=False,
                question_text=decision["next_question"],
            )
            db.session.add(next_turn)

        db.session.commit()

        return jsonify({
            "action": action,
            "transition": decision["transition"],
            "session": session.to_dict(),
            "next_turn": next_turn.to_dict() if next_turn else None,
        }), 200

    @app.post("/api/interview/finish")
    @require_auth
    def finish_interview():
        payload = request.get_json(silent=True) or {}
        session_id = str(payload.get("session_id", "")).strip()
        if not session_id:
            return jsonify({"error": "session_id is required."}), 400

        if mongo_store is not None:
            sess_doc = mongo_store.find_session_by_id(session_id)
            if not sess_doc or sess_doc.get("user_id") != g.current_user["id"]:
                return jsonify({"error": "Interview session not found."}), 404
            existing_report = mongo_store.find_report_by_session_id(session_id)
            if existing_report:
                return jsonify({
                    "session": mongo_store.public_session(sess_doc),
                    "report": mongo_store.public_report(existing_report),
                }), 200
            turns_history = mongo_store.list_turns_for_session(session_id)
            report_data = generate_final_report(
                role=sess_doc["role"],
                experience_level=sess_doc["experience_level"],
                interview_type=sess_doc["interview_type"],
                turns_history=turns_history,
                job_description=sess_doc.get("job_description"),
            )
            dims = report_data["dimensions"]
            updated_sess, saved_rep = mongo_store.save_report_and_complete_session({
                "session_id": session_id,
                "overall_score": report_data["overall_score"],
                "communication_score": dims["communication"],
                "technical_depth_score": dims["technical_depth"],
                "confidence_score": dims["confidence"],
                "relevance_score": dims["relevance"],
                "verdict": report_data["verdict"],
                "summary": report_data["summary"],
                "strengths": report_data["strengths"],
                "weak_areas": report_data["weak_areas"],
                "question_breakdown": report_data["question_breakdown"],
            })
            return jsonify({
                "session": mongo_store.public_session(updated_sess),
                "report": mongo_store.public_report(saved_rep),
            }), 200

        session = db.session.get(InterviewSession, session_id)
        if not session or session.user_id != g.current_user.id:
            return jsonify({"error": "Interview session not found."}), 404

        if session.report:
            return jsonify({
                "session": session.to_dict(),
                "report": session.report.to_dict(),
            }), 200

        turns_history = [t.to_dict() for t in session.turns]
        report_data = generate_final_report(
            role=session.role,
            experience_level=session.experience_level,
            interview_type=session.interview_type,
            turns_history=turns_history,
            job_description=session.job_description,
        )

        dims = report_data["dimensions"]
        report = InterviewReport(
            session_id=session.id,
            overall_score=report_data["overall_score"],
            communication_score=dims["communication"],
            technical_depth_score=dims["technical_depth"],
            confidence_score=dims["confidence"],
            relevance_score=dims["relevance"],
            verdict=report_data["verdict"],
            summary=report_data["summary"],
            strengths_json=json.dumps(report_data["strengths"]),
            weak_areas_json=json.dumps(report_data["weak_areas"]),
            breakdown_json=json.dumps(report_data["question_breakdown"]),
        )

        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        db.session.add(report)
        db.session.commit()

        return jsonify({
            "session": session.to_dict(),
            "report": report.to_dict(),
        }), 200

    @app.get("/api/history")
    @require_auth
    def list_history():
        if mongo_store is not None:
            return jsonify({
                "history": mongo_store.list_completed_history_for_user(g.current_user["id"])
            }), 200

        sessions = (
            InterviewSession.query.filter_by(user_id=g.current_user.id, status="completed")
            .order_by(InterviewSession.created_at.desc())
            .all()
        )
        items = []
        for sess in sessions:
            if not sess.report:
                continue
            items.append({
                "session": sess.to_dict(),
                "overall_score": sess.report.overall_score,
                "dimensions": {
                    "communication": sess.report.communication_score,
                    "technical_depth": sess.report.technical_depth_score,
                    "confidence": sess.report.confidence_score,
                    "relevance": sess.report.relevance_score,
                },
                "verdict": sess.report.verdict,
                "report": sess.report.to_dict(),
            })
        return jsonify({"history": items}), 200

    @app.get("/api/history/<session_id>")
    @require_auth
    def get_history_item(session_id: str):
        if mongo_store is not None:
            sess_doc = mongo_store.find_session_by_id(session_id)
            rep_doc = mongo_store.find_report_by_session_id(session_id)
            if not sess_doc or sess_doc.get("user_id") != g.current_user["id"] or not rep_doc:
                return jsonify({"error": "Completed interview report not found."}), 404
            return jsonify({
                "session": mongo_store.public_session(sess_doc),
                "report": mongo_store.public_report(rep_doc),
            }), 200

        session = db.session.get(InterviewSession, session_id)
        if not session or session.user_id != g.current_user.id or not session.report:
            return jsonify({"error": "Completed interview report not found."}), 404
        return jsonify({
            "session": session.to_dict(),
            "report": session.report.to_dict(),
        }), 200

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
