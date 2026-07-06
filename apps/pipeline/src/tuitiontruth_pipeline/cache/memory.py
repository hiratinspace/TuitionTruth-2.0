from __future__ import annotations

import time
from collections.abc import Callable


class InMemoryCache:
    """Process-local TTL cache. Default implementation for development and
    tests; production uses `RedisCache`. The clock is injectable so expiry is
    deterministically testable."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._store: dict[str, tuple[float, str]] = {}
        self._clock = clock
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> str | None:
        entry = self._store.get(key)
        if entry is None:
            self.misses += 1
            return None
        expires_at, value = entry
        if self._clock() >= expires_at:
            del self._store[key]
            self.misses += 1
            return None
        self.hits += 1
        return value

    def set(self, key: str, value: str, ttl_seconds: int) -> None:
        self._store[key] = (self._clock() + ttl_seconds, value)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    @property
    def hit_ratio(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
