"""Structured JSON logging.

Every pipeline stage logs structured events so failures carry context (source,
institution, stage) into whatever aggregator ingests stdout (TUIT-20 AC #1).
"""

from __future__ import annotations

import json
import logging
from typing import Any


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON with any `extra` fields merged in."""

    _RESERVED = frozenset(logging.LogRecord("", 0, "", 0, "", None, None).__dict__)

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in self._RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info is not None:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    """Install the JSON formatter on the root logger (idempotent)."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger."""
    return logging.getLogger(f"tuitiontruth.{name}")
