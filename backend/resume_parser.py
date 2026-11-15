"""
PDF resume text extraction and sanitization utilities.
"""

import io
import re
from pypdf import PdfReader

MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB upload ceiling
MAX_RESUME_CHARS = 12000


def parse_pdf_resume(file_bytes: bytes, filename: str = "resume.pdf") -> dict:
    """Extract and normalize text from an uploaded PDF file."""
    if not file_bytes:
        raise ValueError("Uploaded PDF file is empty.")

    if len(file_bytes) > MAX_RESUME_BYTES:
        raise ValueError("Resume PDF exceeds the 5 MB file size limit.")

    if not filename.lower().endswith(".pdf") and not file_bytes.startswith(b"%PDF"):
        raise ValueError("Only valid PDF files are supported.")

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError(f"Could not read PDF document: {exc}") from exc

    pages_text = []
    for page in reader.pages:
        extracted = page.extract_text() or ""
        if extracted.strip():
            pages_text.append(extracted)

    combined = "\n\n".join(pages_text)
    # Normalize excess whitespace while keeping paragraph breaks readable
    normalized = re.sub(r"[ \t]+", " ", combined)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()

    if not normalized:
        raise ValueError(
            "No selectable text was found in this PDF. Please upload a text-based PDF or paste your resume summary."
        )

    truncated = False
    if len(normalized) > MAX_RESUME_CHARS:
        normalized = normalized[:MAX_RESUME_CHARS].rstrip() + "..."
        truncated = True

    word_count = len(normalized.split())
    return {
        "filename": filename,
        "page_count": len(reader.pages),
        "word_count": word_count,
        "char_count": len(normalized),
        "truncated": truncated,
        "text": normalized,
    }
