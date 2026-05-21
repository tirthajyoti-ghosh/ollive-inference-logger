import logging
import re

logger = logging.getLogger(__name__)


class SimpleRedactor:
    """Regex-based PII redactor as a fallback when Presidio/spaCy is unavailable."""

    PATTERNS = {
        "EMAIL": re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        ),
        "PHONE": re.compile(
            r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
        ),
        "SSN": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "CREDIT_CARD": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
        "IP_ADDRESS": re.compile(
            r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
        ),
    }

    def redact(self, text: str) -> str:
        if not text:
            return text
        result = text
        for entity_type, pattern in self.PATTERNS.items():
            result = pattern.sub(f"<{entity_type}>", result)
        return result


class DeepRedactor:
    """PII redactor using Microsoft Presidio for comprehensive entity detection."""

    ENTITIES = [
        "PERSON",
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
        "CREDIT_CARD",
        "LOCATION",
        "US_SSN",
        "IP_ADDRESS",
        "IBAN_CODE",
    ]

    def __init__(self) -> None:
        try:
            from presidio_analyzer import AnalyzerEngine
            from presidio_anonymizer import AnonymizerEngine

            self._analyzer = AnalyzerEngine()
            self._anonymizer = AnonymizerEngine()
            # Warm up: run a small analysis to verify spaCy model is loaded
            self._analyzer.analyze(text="test", language="en", entities=["PERSON"])
            self._fallback = False
            logger.info("Presidio PII redactor initialized successfully")
        except Exception as exc:
            logger.warning(
                "Presidio initialization failed (%s), falling back to regex redactor",
                exc,
            )
            self._fallback = True
            self._simple = SimpleRedactor()

    def redact(self, text: str) -> str:
        if not text:
            return text

        if self._fallback:
            return self._simple.redact(text)

        results = self._analyzer.analyze(
            text=text,
            language="en",
            entities=self.ENTITIES,
        )
        anonymized = self._anonymizer.anonymize(text=text, analyzer_results=results)
        return anonymized.text
