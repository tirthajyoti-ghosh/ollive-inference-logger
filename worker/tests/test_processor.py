import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.worker.processor import (
    PRICING,
    InferenceLogData,
    ProcessingPipeline,
    ProcessingResult,
    estimate_cost,
)
from src.worker.redactor import SimpleRedactor


# ---------------------------------------------------------------------------
# Cost estimation tests
# ---------------------------------------------------------------------------

class TestEstimateCost:
    def test_known_model_cost(self):
        """GPT-4o: 100 prompt tokens + 50 completion tokens."""
        cost = estimate_cost("openai", "gpt-4o", 100, 50)
        expected = 100 * (2.50 / 1_000_000) + 50 * (10.00 / 1_000_000)
        assert cost == round(expected, 6)

    def test_unknown_model_returns_none(self):
        cost = estimate_cost("unknown_provider", "mystery-model", 100, 50)
        assert cost is None

    def test_zero_tokens_returns_none(self):
        cost = estimate_cost("openai", "gpt-4o", 0, 0)
        assert cost is None

    def test_none_tokens_returns_none(self):
        cost = estimate_cost("openai", "gpt-4o", None, None)
        assert cost is None

    def test_only_prompt_tokens(self):
        cost = estimate_cost("openai", "gpt-4o-mini", 1000, None)
        expected = 1000 * (0.15 / 1_000_000)
        assert cost == round(expected, 6)

    def test_only_completion_tokens(self):
        cost = estimate_cost("openai", "gpt-4o-mini", None, 500)
        expected = 500 * (0.60 / 1_000_000)
        assert cost == round(expected, 6)

    def test_anthropic_pricing(self):
        cost = estimate_cost("anthropic", "claude-sonnet-4-20250514", 200, 100)
        expected = 200 * (3.00 / 1_000_000) + 100 * (15.00 / 1_000_000)
        assert cost == round(expected, 6)

    def test_groq_pricing(self):
        cost = estimate_cost("groq", "llama-3.1-70b-versatile", 500, 300)
        expected = 500 * (0.59 / 1_000_000) + 300 * (0.79 / 1_000_000)
        assert cost == round(expected, 6)


# ---------------------------------------------------------------------------
# PII redaction integration tests
# ---------------------------------------------------------------------------

class TestPIIRedaction:
    def setup_method(self):
        self.redactor = SimpleRedactor()

    def test_email_redaction(self):
        text = "Contact john.doe@example.com for details"
        result = self.redactor.redact(text)
        assert "john.doe@example.com" not in result
        assert "<EMAIL>" in result

    def test_phone_redaction(self):
        text = "Call me at 555-123-4567"
        result = self.redactor.redact(text)
        assert "555-123-4567" not in result
        assert "<PHONE>" in result

    def test_ssn_redaction(self):
        text = "My SSN is 123-45-6789"
        result = self.redactor.redact(text)
        assert "123-45-6789" not in result
        assert "<SSN>" in result

    def test_credit_card_redaction(self):
        text = "Card number: 4111-1111-1111-1111"
        result = self.redactor.redact(text)
        assert "4111-1111-1111-1111" not in result
        assert "<CREDIT_CARD>" in result

    def test_ip_address_redaction(self):
        text = "Server at 192.168.1.100"
        result = self.redactor.redact(text)
        assert "192.168.1.100" not in result
        assert "<IP_ADDRESS>" in result

    def test_empty_text_passthrough(self):
        assert self.redactor.redact("") == ""
        assert self.redactor.redact(None) is None

    def test_no_pii_unchanged(self):
        text = "Hello world, this is a normal message"
        assert self.redactor.redact(text) == text

    def test_multiple_pii_entities(self):
        text = "Email john@test.com, call 555-123-4567, SSN 123-45-6789"
        result = self.redactor.redact(text)
        assert "john@test.com" not in result
        assert "555-123-4567" not in result
        assert "123-45-6789" not in result


# ---------------------------------------------------------------------------
# InferenceLogData validation tests
# ---------------------------------------------------------------------------

class TestInferenceLogData:
    def test_valid_minimal_payload(self):
        data = InferenceLogData(
            provider="openai",
            model="gpt-4o",
            request_timestamp=datetime.now(tz=timezone.utc),
        )
        assert data.provider == "openai"
        assert data.status == "success"
        assert data.is_streaming is False
        assert data.metadata == {}

    def test_uuid_string_conversion(self):
        uid = str(uuid.uuid4())
        data = InferenceLogData(
            id=uid,
            provider="openai",
            model="gpt-4o",
            request_timestamp=datetime.now(tz=timezone.utc),
        )
        assert isinstance(data.id, uuid.UUID)
        assert str(data.id) == uid

    def test_null_uuid_stays_none(self):
        data = InferenceLogData(
            provider="openai",
            model="gpt-4o",
            request_timestamp=datetime.now(tz=timezone.utc),
        )
        assert data.conversation_id is None
        assert data.message_id is None

    def test_timestamp_string_parsing(self):
        ts = "2025-05-21T10:30:00+00:00"
        data = InferenceLogData(
            provider="openai",
            model="gpt-4o",
            request_timestamp=ts,
        )
        assert isinstance(data.request_timestamp, datetime)


# ---------------------------------------------------------------------------
# Batch processing tests
# ---------------------------------------------------------------------------

class TestProcessingPipeline:
    @pytest.fixture
    def mock_session_factory(self):
        """Create a mock async session factory that supports context managers."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()

        # Support `async with session.begin():`
        mock_begin = AsyncMock()
        mock_begin.__aenter__ = AsyncMock(return_value=mock_begin)
        mock_begin.__aexit__ = AsyncMock(return_value=False)
        mock_session.begin = MagicMock(return_value=mock_begin)

        # Support `async with factory() as session:`
        mock_context = AsyncMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_session)
        mock_context.__aexit__ = AsyncMock(return_value=False)

        factory = MagicMock(return_value=mock_context)
        return factory, mock_session

    @pytest.fixture
    def pipeline(self, mock_session_factory):
        factory, _ = mock_session_factory
        return ProcessingPipeline(
            db_session_factory=factory,
            redactor=SimpleRedactor(),
        )

    @pytest.mark.asyncio
    async def test_process_valid_batch(self, pipeline, mock_session_factory):
        _, mock_session = mock_session_factory
        messages = [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "request_timestamp": "2025-05-21T10:00:00+00:00",
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "input_preview": "Hello world",
                "output_preview": "Hi there",
            },
            {
                "provider": "anthropic",
                "model": "claude-sonnet-4-20250514",
                "request_timestamp": "2025-05-21T10:01:00+00:00",
                "prompt_tokens": 200,
                "completion_tokens": 100,
            },
        ]

        result = await pipeline.process_batch(messages)
        assert result.processed == 2
        assert result.failed == 0
        assert result.errors == []

        # Verify batch insert was called
        assert mock_session.execute.called

    @pytest.mark.asyncio
    async def test_process_batch_with_invalid_message(self, pipeline):
        messages = [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "request_timestamp": "2025-05-21T10:00:00+00:00",
            },
            {
                # Missing required fields: provider, model, request_timestamp
                "session_id": "test",
            },
        ]

        result = await pipeline.process_batch(messages)
        assert result.processed == 1
        assert result.failed == 1
        assert len(result.errors) == 1

    @pytest.mark.asyncio
    async def test_cost_enrichment_in_batch(self, pipeline, mock_session_factory):
        _, mock_session = mock_session_factory
        messages = [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "request_timestamp": "2025-05-21T10:00:00+00:00",
                "prompt_tokens": 1000,
                "completion_tokens": 500,
                # estimated_cost_usd not set — should be calculated
            },
        ]

        result = await pipeline.process_batch(messages)
        assert result.processed == 1

        # Verify the insert was called with enriched cost
        call_args = mock_session.execute.call_args_list[0]
        inserted_rows = call_args[0][1]  # Second positional arg is the list of rows
        assert inserted_rows[0]["estimated_cost_usd"] is not None
        expected_cost = 1000 * (2.50 / 1_000_000) + 500 * (10.00 / 1_000_000)
        assert inserted_rows[0]["estimated_cost_usd"] == round(expected_cost, 6)

    @pytest.mark.asyncio
    async def test_pii_redaction_in_batch(self, pipeline, mock_session_factory):
        _, mock_session = mock_session_factory
        messages = [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "request_timestamp": "2025-05-21T10:00:00+00:00",
                "input_preview": "Send email to john@example.com",
                "output_preview": "Call 555-123-4567 for support",
            },
        ]

        result = await pipeline.process_batch(messages)
        assert result.processed == 1

        call_args = mock_session.execute.call_args_list[0]
        inserted_rows = call_args[0][1]
        assert "john@example.com" not in inserted_rows[0]["input_preview"]
        assert "555-123-4567" not in inserted_rows[0]["output_preview"]

    @pytest.mark.asyncio
    async def test_empty_batch(self, pipeline):
        result = await pipeline.process_batch([])
        assert result.processed == 0
        assert result.failed == 0

    @pytest.mark.asyncio
    async def test_preserves_explicit_cost(self, pipeline, mock_session_factory):
        _, mock_session = mock_session_factory
        messages = [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "request_timestamp": "2025-05-21T10:00:00+00:00",
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "estimated_cost_usd": 0.999,
            },
        ]

        result = await pipeline.process_batch(messages)
        assert result.processed == 1

        call_args = mock_session.execute.call_args_list[0]
        inserted_rows = call_args[0][1]
        assert inserted_rows[0]["estimated_cost_usd"] == 0.999
