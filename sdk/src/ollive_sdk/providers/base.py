"""Abstract base class for provider wrappers."""

from __future__ import annotations

import abc
from typing import Any, Callable


class AbstractProviderWrapper(abc.ABC):
    """Base class for auto-instrumentation wrappers.

    Subclasses must implement :meth:`wrap` and :meth:`unwrap`.
    """

    def __init__(
        self,
        enqueue_fn: Callable,
        redact_fn: Callable,
    ) -> None:
        self._enqueue_fn = enqueue_fn
        self._redact_fn = redact_fn
        self._originals: dict[str, Any] = {}

    @abc.abstractmethod
    def wrap(self, module: Any) -> None:
        """Monkey-patch the provider module to intercept inference calls."""

    @abc.abstractmethod
    def unwrap(self, module: Any) -> None:
        """Restore original, unpatched methods."""
