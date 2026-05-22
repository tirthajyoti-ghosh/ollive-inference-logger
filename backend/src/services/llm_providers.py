from collections.abc import AsyncIterator
from dataclasses import dataclass

import litellm

from src.config import settings

PROVIDER_MODELS: dict[str, list[str]] = {
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
        "o1-preview",
        "o1-mini",
    ],
    "anthropic": [
        "claude-sonnet-4-20250514",
        "claude-haiku-4-5-20251001",
    ],
    "groq": [
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
    ],
    "gemini": [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
    ],
}

# Map provider names to litellm prefixes
_LITELLM_PREFIX: dict[str, str] = {
    "openai": "",
    "anthropic": "anthropic/",
    "groq": "groq/",
    "gemini": "gemini/",
}


def _configure_keys() -> None:
    """Push API keys from settings into litellm's env-style config."""
    if settings.openai_api_key:
        litellm.openai_key = settings.openai_api_key
    if settings.anthropic_api_key:
        litellm.anthropic_key = settings.anthropic_api_key
    if settings.groq_api_key:
        litellm.groq_key = settings.groq_api_key
    if settings.gemini_api_key:
        import os
        os.environ["GEMINI_API_KEY"] = settings.gemini_api_key


_configure_keys()


@dataclass
class LLMResponse:
    content: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str
    provider: str


class LLMService:
    """Unified multi-provider LLM service backed by litellm."""

    def _litellm_model(self, provider: str, model: str) -> str:
        prefix = _LITELLM_PREFIX.get(provider, f"{provider}/")
        return f"{prefix}{model}"

    async def complete(
        self,
        messages: list[dict[str, str]],
        provider: str,
        model: str,
        stream: bool = False,
    ) -> LLMResponse:
        litellm_model = self._litellm_model(provider, model)
        response = await litellm.acompletion(
            model=litellm_model,
            messages=messages,
            stream=False,
        )
        choice = response.choices[0]
        usage = response.usage
        return LLMResponse(
            content=choice.message.content or "",
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
            model=model,
            provider=provider,
        )

    async def stream(
        self,
        messages: list[dict[str, str]],
        provider: str,
        model: str,
    ) -> AsyncIterator[tuple[str, str]]:
        """Yield (type, text) tuples. type is 'thinking', 'text', or 'usage'."""
        litellm_model = self._litellm_model(provider, model)
        response = await litellm.acompletion(
            model=litellm_model,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
        )
        async for chunk in response:
            # Final chunk: empty choices, usage present
            if hasattr(chunk, "usage") and chunk.usage and (not chunk.choices or not chunk.choices[0].delta):
                yield ("usage", f"{chunk.usage.prompt_tokens},{chunk.usage.completion_tokens},{chunk.usage.total_tokens}")
                continue
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if not delta:
                continue
            thinking = getattr(delta, "reasoning_content", None) or getattr(delta, "thought", None)
            if thinking:
                yield ("thinking", thinking)
            if delta.content:
                yield ("text", delta.content)

    @staticmethod
    def list_providers() -> dict[str, list[str]]:
        return PROVIDER_MODELS
