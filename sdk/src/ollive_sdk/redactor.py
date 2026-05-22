"""PII redaction via compiled regexes. No ML dependencies, sub-millisecond."""

import re
from typing import Literal


_STANDARD_PATTERNS: dict[str, re.Pattern[str]] = {
    "EMAIL": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "PHONE_US": re.compile(
        r"(?<!\d)"
        r"(?:\+?1[-.\s]?)?"
        r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
        r"(?!\d)"
    ),
    "PHONE_IN": re.compile(
        r"(?<!\d)"
        r"(?:\+91[-.\s]?)?\d{5}[-.\s]?\d{5}"
        r"(?!\d)"
    ),
    "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "CREDIT_CARD": re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
    "IP_ADDRESS": re.compile(
        r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
        r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
    ),
    "AADHAAR": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
    "AWS_ACCESS_KEY": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "AWS_SECRET_KEY": re.compile(
        r"(?i)(?:aws_secret_access_key|aws_secret)\s*[=:]\s*"
        r"[A-Za-z0-9/+=]{30,}"
    ),
    "API_KEY": re.compile(r"\b(?:sk|key)-[a-zA-Z0-9]{20,}\b"),
    "BEARER_TOKEN": re.compile(r"\bBearer\s+[a-zA-Z0-9._\-]{10,}\b"),
}

_AGGRESSIVE_PATTERNS: dict[str, re.Pattern[str]] = {
    "LONG_NUMBER": re.compile(r"\b\d{5,}\b"),
    "DATE": re.compile(
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"
        r"|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b"
    ),
    "URL": re.compile(r"https?://[^\s]+"),
}

RedactionLevel = Literal["off", "standard", "aggressive"]


class PIIRedactor:
    """Fast regex-based PII redactor.

    Parameters
    ----------
    level : RedactionLevel
        ``"off"`` — pass-through, no redaction.
        ``"standard"`` — redact emails, phones, SSNs, credit cards, IPs, Aadhaar.
        ``"aggressive"`` — standard + long numbers, dates, and URLs.
    """

    def __init__(self, level: RedactionLevel = "standard") -> None:
        self.level = level
        self._patterns: dict[str, re.Pattern[str]] = {}
        if level == "standard":
            self._patterns = dict(_STANDARD_PATTERNS)
        elif level == "aggressive":
            self._patterns = {**_STANDARD_PATTERNS, **_AGGRESSIVE_PATTERNS}
        # "off" → empty dict, redact() is a no-op.

    def redact(self, text: str) -> str:
        """Replace PII matches with ``[REDACTED:{type}]`` tokens."""
        if not self._patterns or not text:
            return text
        for name, pattern in self._patterns.items():
            text = pattern.sub(f"[REDACTED:{name}]", text)
        return text
