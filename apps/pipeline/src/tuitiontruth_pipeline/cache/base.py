from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class Cache(Protocol):
    """Read-through cache contract. Implementations must degrade gracefully:
    a backend failure returns a miss rather than raising, so callers fall back
    to the live source (TUIT-12 AC #5)."""

    hits: int
    misses: int

    def get(self, key: str) -> str | None: ...

    def set(self, key: str, value: str, ttl_seconds: int) -> None: ...

    def delete(self, key: str) -> None: ...

    @property
    def hit_ratio(self) -> float: ...
