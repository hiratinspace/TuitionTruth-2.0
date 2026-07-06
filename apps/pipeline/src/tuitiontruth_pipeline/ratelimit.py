"""Rate limiting primitives.

`SlidingWindowRateLimiter` keeps external API throughput under a hard ceiling
(the Scorecard 1,000 req/hour limit — TUIT-12 AC #4). `PerDomainRateLimiter`
enforces polite per-domain spacing for the scraper so crawling never resembles
an attack (TUIT-13 AC #3). Both take injectable clock/sleep functions so timing
is deterministically testable.
"""

from __future__ import annotations

import asyncio
import time
from collections import deque
from collections.abc import Awaitable, Callable


class SlidingWindowRateLimiter:
    """Allows at most `max_calls` within any `period_seconds` window."""

    def __init__(
        self,
        max_calls: int,
        period_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if max_calls < 1:
            raise ValueError("max_calls must be >= 1")
        self._max = max_calls
        self._period = period_seconds
        self._clock = clock
        self._sleep = sleep
        self._calls: deque[float] = deque()

    def _evict(self, now: float) -> None:
        while self._calls and now - self._calls[0] >= self._period:
            self._calls.popleft()

    def acquire(self) -> None:
        """Block until a call is permitted, then record it."""
        now = self._clock()
        self._evict(now)
        if len(self._calls) >= self._max:
            wait = self._period - (now - self._calls[0])
            if wait > 0:
                self._sleep(wait)
            now = self._clock()
            self._evict(now)
        self._calls.append(self._clock())


class PerDomainRateLimiter:
    """Ensures at least `min_interval_seconds` between requests to the same
    domain. Async so many domains proceed concurrently while each domain stays
    polite (throughput comes from breadth, never from hammering one host)."""

    def __init__(
        self,
        min_interval_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._min = min_interval_seconds
        self._clock = clock
        self._sleep = sleep
        self._last_hit: dict[str, float] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def acquire(self, domain: str) -> None:
        lock = self._locks.setdefault(domain, asyncio.Lock())
        async with lock:
            last = self._last_hit.get(domain)
            if last is not None:
                elapsed = self._clock() - last
                if elapsed < self._min:
                    await self._sleep(self._min - elapsed)
            self._last_hit[domain] = self._clock()
