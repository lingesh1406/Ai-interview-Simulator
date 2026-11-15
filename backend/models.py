"""
SQLAlchemy ORM models for persisting users, interview sessions, conversation turns,
and final evaluation reports in SQLite.
"""

from datetime import datetime, timezone
import json
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(64), primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    sessions = db.relationship(
        "InterviewSession",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InterviewSession(db.Model):
    __tablename__ = "interview_sessions"

    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(
        db.String(64),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    role = db.Column(db.String(160), nullable=False)
    experience_level = db.Column(db.String(32), nullable=False)
    interview_type = db.Column(db.String(32), nullable=False)
    total_questions = db.Column(db.Integer, nullable=False, default=5)
    seconds_per_question = db.Column(db.Integer, nullable=False, default=120)
    current_question_index = db.Column(db.Integer, nullable=False, default=1)
    resume_text = db.Column(db.Text, nullable=True)
    job_description = db.Column(db.Text, nullable=True)
    demo_mode = db.Column(db.Boolean, nullable=False, default=False)
    status = db.Column(db.String(24), nullable=False, default="in_progress")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    turns = db.relationship(
        "InterviewTurn",
        backref="session",
        lazy=True,
        order_by="InterviewTurn.sequence_number",
        cascade="all, delete-orphan",
    )
    report = db.relationship(
        "InterviewReport",
        backref="session",
        uselist=False,
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "role": self.role,
            "experience_level": self.experience_level,
            "interview_type": self.interview_type,
            "total_questions": self.total_questions,
            "seconds_per_question": self.seconds_per_question,
            "current_question_index": self.current_question_index,
            "has_resume": bool(self.resume_text),
            "has_job_description": bool(self.job_description),
            "demo_mode": self.demo_mode,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class InterviewTurn(db.Model):
    __tablename__ = "interview_turns"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(
        db.String(64),
        db.ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence_number = db.Column(db.Integer, nullable=False)
    question_number = db.Column(db.Integer, nullable=False)
    is_followup = db.Column(db.Boolean, nullable=False, default=False)
    question_text = db.Column(db.Text, nullable=False)
    answer_text = db.Column(db.Text, nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=True)
    interviewer_transition = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "session_id": self.session_id,
            "sequence_number": self.sequence_number,
            "question_number": self.question_number,
            "is_followup": self.is_followup,
            "question_text": self.question_text,
            "answer_text": self.answer_text,
            "duration_seconds": self.duration_seconds,
            "interviewer_transition": self.interviewer_transition,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InterviewReport(db.Model):
    __tablename__ = "interview_reports"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    session_id = db.Column(
        db.String(64),
        db.ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    overall_score = db.Column(db.Integer, nullable=False)
    communication_score = db.Column(db.Integer, nullable=False)
    technical_depth_score = db.Column(db.Integer, nullable=False)
    confidence_score = db.Column(db.Integer, nullable=False)
    relevance_score = db.Column(db.Integer, nullable=False)
    verdict = db.Column(db.String(64), nullable=False)
    summary = db.Column(db.Text, nullable=False)
    strengths_json = db.Column(db.Text, nullable=False)
    weak_areas_json = db.Column(db.Text, nullable=False)
    breakdown_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utc_now)

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "overall_score": self.overall_score,
            "dimensions": {
                "communication": self.communication_score,
                "technical_depth": self.technical_depth_score,
                "confidence": self.confidence_score,
                "relevance": self.relevance_score,
            },
            "verdict": self.verdict,
            "summary": self.summary,
            "strengths": json.loads(self.strengths_json or "[]"),
            "weak_areas": json.loads(self.weak_areas_json or "[]"),
            "question_breakdown": json.loads(self.breakdown_json or "[]"),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
