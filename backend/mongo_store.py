"""
MongoDB Atlas storage adapter for the optional Flask backend.
Used automatically when MONGODB_URI is set in the environment.
"""

from datetime import datetime, timezone
import os
from typing import Any, Optional
from urllib.parse import urlparse

from pymongo import ASCENDING, DESCENDING, MongoClient


def get_configured_mongo_uri() -> str:
    uri = os.getenv("MONGODB_URI", "").strip()
    if (
        not uri
        or uri == "MY_MONGODB_URI"
        or "<username>" in uri
        or "<password>" in uri
        or "<cluster>" in uri
    ):
        return ""
    return uri


def _resolve_db_name(uri: str) -> str:
    explicit = os.getenv("MONGODB_DB_NAME", "").strip()
    if explicit:
        return explicit
    try:
        parsed = urlparse(uri)
        db_path = (parsed.path or "").lstrip("/").strip()
        if db_path:
            return db_path
    except Exception:
        pass
    return "ai_interview_simulator"


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MongoStore:
    def __init__(self, uri: str):
        self.db_name = _resolve_db_name(uri)
        self.client = MongoClient(uri, serverSelectionTimeoutMS=8000)
        self.db = self.client[self.db_name]
        self.db.command("ping")

        self.users = self.db["users"]
        self.sessions = self.db["interview_sessions"]
        self.turns = self.db["interview_turns"]
        self.reports = self.db["interview_reports"]

        self.users.create_index([("id", ASCENDING)], unique=True)
        self.users.create_index([("email", ASCENDING)], unique=True)
        self.sessions.create_index([("id", ASCENDING)], unique=True)
        self.sessions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        self.turns.create_index([("id", ASCENDING)], unique=True)
        self.turns.create_index([("session_id", ASCENDING), ("sequence_number", ASCENDING)])
        self.reports.create_index([("session_id", ASCENDING)], unique=True)

    @staticmethod
    def public_user(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": doc["id"],
            "full_name": doc["full_name"],
            "email": doc["email"],
            "created_at": doc.get("created_at"),
        }

    @staticmethod
    def public_session(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": doc["id"],
            "user_id": doc.get("user_id"),
            "role": doc["role"],
            "experience_level": doc["experience_level"],
            "interview_type": doc["interview_type"],
            "total_questions": doc["total_questions"],
            "seconds_per_question": doc["seconds_per_question"],
            "current_question_index": doc["current_question_index"],
            "has_resume": bool(doc.get("resume_text")),
            "has_job_description": bool(doc.get("job_description")),
            "demo_mode": bool(doc.get("demo_mode")),
            "status": doc["status"],
            "created_at": doc.get("created_at"),
            "completed_at": doc.get("completed_at"),
        }

    @staticmethod
    def public_report(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "session_id": doc["session_id"],
            "overall_score": doc["overall_score"],
            "dimensions": {
                "communication": doc["communication_score"],
                "technical_depth": doc["technical_depth_score"],
                "confidence": doc["confidence_score"],
                "relevance": doc["relevance_score"],
            },
            "verdict": doc["verdict"],
            "summary": doc["summary"],
            "strengths": doc.get("strengths", []),
            "weak_areas": doc.get("weak_areas", []),
            "question_breakdown": doc.get("question_breakdown", []),
            "created_at": doc.get("created_at"),
        }

    def find_user_by_id(self, user_id: str) -> Optional[dict[str, Any]]:
        return self.users.find_one({"id": user_id}, {"_id": 0})

    def find_user_by_email(self, email: str) -> Optional[dict[str, Any]]:
        return self.users.find_one({"email": email}, {"_id": 0})

    def create_user(self, doc: dict[str, Any]) -> dict[str, Any]:
        payload = {**doc, "created_at": doc.get("created_at") or _utc_iso()}
        self.users.insert_one(dict(payload))
        return payload

    def create_session_and_first_turn(
        self, session_doc: dict[str, Any], turn_doc: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        now = _utc_iso()
        s_doc = {**session_doc, "created_at": session_doc.get("created_at") or now, "completed_at": None}
        t_doc = {**turn_doc, "created_at": turn_doc.get("created_at") or now}
        self.sessions.insert_one(dict(s_doc))
        self.turns.insert_one(dict(t_doc))
        return s_doc, t_doc

    def find_session_by_id(self, session_id: str) -> Optional[dict[str, Any]]:
        return self.sessions.find_one({"id": session_id}, {"_id": 0})

    def list_turns_for_session(self, session_id: str) -> list[dict[str, Any]]:
        return list(
            self.turns.find({"session_id": session_id}, {"_id": 0}).sort("sequence_number", ASCENDING)
        )

    def update_turn_answer(self, turn_id: str, answer_text: str, duration_seconds: int) -> None:
        self.turns.update_one(
            {"id": turn_id},
            {"$set": {"answer_text": answer_text, "duration_seconds": duration_seconds}},
        )

    def update_turn_transition(self, turn_id: str, transition: str) -> None:
        self.turns.update_one({"id": turn_id}, {"$set": {"interviewer_transition": transition}})

    def increment_session_question_index(self, session_id: str, next_index: int) -> Optional[dict[str, Any]]:
        self.sessions.update_one(
            {"id": session_id},
            {"$set": {"current_question_index": next_index}},
        )
        return self.find_session_by_id(session_id)

    def create_turn(self, turn_doc: dict[str, Any]) -> dict[str, Any]:
        t_doc = {**turn_doc, "created_at": turn_doc.get("created_at") or _utc_iso()}
        self.turns.insert_one(dict(t_doc))
        return t_doc

    def find_report_by_session_id(self, session_id: str) -> Optional[dict[str, Any]]:
        return self.reports.find_one({"session_id": session_id}, {"_id": 0})

    def save_report_and_complete_session(
        self, report_doc: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        now = report_doc.get("created_at") or _utc_iso()
        r_doc = {**report_doc, "created_at": now}
        self.reports.insert_one(dict(r_doc))
        self.sessions.update_one(
            {"id": r_doc["session_id"]},
            {"$set": {"status": "completed", "completed_at": now}},
        )
        updated_session = self.find_session_by_id(r_doc["session_id"]) or {}
        return updated_session, r_doc

    def list_completed_history_for_user(self, user_id: str) -> list[dict[str, Any]]:
        sessions = list(
            self.sessions.find({"user_id": user_id, "status": "completed"}, {"_id": 0}).sort(
                "created_at", DESCENDING
            )
        )
        if not sessions:
            return []
        session_ids = [s["id"] for s in sessions]
        reports = {
            r["session_id"]: r
            for r in self.reports.find({"session_id": {"$in": session_ids}}, {"_id": 0})
        }
        items = []
        for sess in sessions:
            rep = reports.get(sess["id"])
            if not rep:
                continue
            items.append({
                "session": self.public_session(sess),
                "overall_score": rep["overall_score"],
                "dimensions": {
                    "communication": rep["communication_score"],
                    "technical_depth": rep["technical_depth_score"],
                    "confidence": rep["confidence_score"],
                    "relevance": rep["relevance_score"],
                },
                "verdict": rep["verdict"],
                "report": self.public_report(rep),
            })
        return items
