"""Tests for PII redaction."""

from ollive_sdk.redactor import PIIRedactor


class TestRedactorOff:
    def test_passthrough(self):
        r = PIIRedactor(level="off")
        text = "email: foo@bar.com, ssn: 123-45-6789"
        assert r.redact(text) == text

    def test_empty_string(self):
        r = PIIRedactor(level="off")
        assert r.redact("") == ""


class TestRedactorStandard:
    def setup_method(self):
        self.r = PIIRedactor(level="standard")

    def test_email(self):
        assert "[REDACTED:EMAIL]" in self.r.redact("Contact me at alice@example.com please")

    def test_phone_us(self):
        assert "[REDACTED:PHONE_US]" in self.r.redact("Call 555-123-4567")

    def test_phone_us_with_country_code(self):
        assert "[REDACTED:PHONE_US]" in self.r.redact("Call +1-555-123-4567")

    def test_phone_in(self):
        assert "[REDACTED:PHONE_IN]" in self.r.redact("Call +91-98765-43210")

    def test_ssn(self):
        assert "[REDACTED:SSN]" in self.r.redact("SSN is 123-45-6789")

    def test_credit_card(self):
        assert "[REDACTED:CREDIT_CARD]" in self.r.redact("Card: 4111 1111 1111 1111")

    def test_ip_address(self):
        assert "[REDACTED:IP_ADDRESS]" in self.r.redact("Server at 192.168.1.1")

    def test_aadhaar(self):
        assert "[REDACTED:AADHAAR]" in self.r.redact("Aadhaar: 1234 5678 9012")

    def test_non_pii_unchanged(self):
        text = "The quick brown fox jumps over the lazy dog."
        assert self.r.redact(text) == text

    def test_multiple_patterns(self):
        text = "Email: a@b.com, SSN: 123-45-6789"
        result = self.r.redact(text)
        assert "[REDACTED:EMAIL]" in result
        assert "[REDACTED:SSN]" in result

    def test_standard_does_not_redact_urls(self):
        text = "Visit https://example.com for details"
        result = self.r.redact(text)
        assert "https://example.com" in result


class TestRedactorAggressive:
    def setup_method(self):
        self.r = PIIRedactor(level="aggressive")

    def test_long_number(self):
        assert "[REDACTED:LONG_NUMBER]" in self.r.redact("Account 1234567890")

    def test_date(self):
        result = self.r.redact("Born on 12/25/1990")
        assert "[REDACTED:DATE]" in result

    def test_iso_date(self):
        result = self.r.redact("Date: 2024-01-15")
        assert "[REDACTED:DATE]" in result

    def test_url(self):
        assert "[REDACTED:URL]" in self.r.redact("Visit https://secret.example.com/path?q=1")

    def test_still_catches_standard_patterns(self):
        result = self.r.redact("Email: foo@bar.com")
        assert "[REDACTED:EMAIL]" in result

    def test_non_pii_unchanged(self):
        text = "Hello world, this is fine."
        assert self.r.redact(text) == text
