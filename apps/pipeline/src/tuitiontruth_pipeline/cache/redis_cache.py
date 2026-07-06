from __future__ import annotations

from typing import TYPE_CHECKING

from tuitiontruth_pipeline.logging_config import get_logger

if TYPE_CHECKING:
    from redis import Redis

logger = get_logger("cache.redis")


class RedisCache:
    """Redis-backed cache. Any backend error is swallowed and treated as a miss
    (reads) or a no-op (writes) so a Redis outage degrades to direct source
    calls rather than a hard failure (TUIT-12 AC #5)."""

    def __init__(self, url: str) -> None:
        import redis  # local import: redis is only needed in production

        self._client: Redis = redis.Redis.from_url(url, decode_responses=True)
        self._redis_error = redis.RedisError
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> str | None:
        try:
            value = self._client.get(key)
        except self._redis_error:
            logger.warning("cache_get_failed", extra={"key": key})
            self.misses += 1
            return None
        if value is None:
            self.misses += 1
            return None
        self.hits += 1
        return str(value)

    def set(self, key: str, value: str, ttl_seconds: int) -> None:
        try:
            self._client.set(key, value, ex=ttl_seconds)
        except self._redis_error:
            logger.warning("cache_set_failed", extra={"key": key})

    def delete(self, key: str) -> None:
        try:
            self._client.delete(key)
        except self._redis_error:
            logger.warning("cache_delete_failed", extra={"key": key})

    @property
    def hit_ratio(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0
