"""Structured error handling & alerting (TUIT-20).

Pipeline stages emit `PipelineError` events with context. Critical failures
page a channel (Slack); non-critical ones are logged and surface on a dashboard.
A throttling wrapper deduplicates identical alerts within a window to prevent
alert fatigue.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal, Protocol

from tuitiontruth_pipeline.logging_config import get_logger

if TYPE_CHECKING:
    import httpx

logger = get_logger("orchestration.errors")

Severity = Literal["critical", "warning"]


@dataclass(frozen=True)
class PipelineError:
    stage: str
    source: str
    severity: Severity
    message: str
    institution_id: int | None = None

    def dedup_key(self) -> str:
        return f"{self.stage}:{self.source}:{self.message}"


class Alerter(Protocol):
    def send(self, error: PipelineError) -> None: ...


class ConsoleAlerter:
    """Logs every error; the default sink and a dashboard feed."""

    def send(self, error: PipelineError) -> None:
        log = logger.error if error.severity == "critical" else logger.warning
        log(
            "pipeline_error",
            extra={
                "stage": error.stage,
                "source": error.source,
                "severity": error.severity,
                # NB: "message" is a reserved LogRecord attribute — use a distinct key.
                "error_message": error.message,
                "institution_id": error.institution_id,
            },
        )


class SlackAlerter:
    """Posts critical errors to a Slack incoming webhook. Warnings are dropped
    here (they belong on the dashboard, not the pager)."""

    def __init__(self, webhook_url: str, http_client: httpx.Client) -> None:
        self._webhook_url = webhook_url
        self._client = http_client

    def send(self, error: PipelineError) -> None:
        if error.severity != "critical" or not self._webhook_url:
            return
        text = f":rotating_light: [{error.stage}/{error.source}] {error.message}"
        try:
            self._client.post(self._webhook_url, json={"text": text})
        except Exception as exc:
            logger.error("slack_alert_failed", extra={"error": str(exc)})


class ThrottlingAlerter:
    """Wraps an alerter and suppresses repeat alerts with the same dedup key
    within `window_seconds` (TUIT-20 AC #4)."""

    def __init__(
        self,
        inner: Alerter,
        window_seconds: float = 300.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._inner = inner
        self._window = window_seconds
        self._clock = clock
        self._last_sent: dict[str, float] = {}
        self.suppressed_count = 0

    def send(self, error: PipelineError) -> None:
        key = error.dedup_key()
        now = self._clock()
        last = self._last_sent.get(key)
        if last is not None and now - last < self._window:
            self.suppressed_count += 1
            return
        self._last_sent[key] = now
        self._inner.send(error)
