"""College Scorecard API client (TUIT-10).

Authenticates with an api.data.gov key, selects only the fields we map, handles
the documented 1,000 req/hour limit via a shared rate limiter, retries 429/5xx
with backoff (honoring Retry-After), and caches successful responses so repeated
pulls of slow-changing data don't burn the quota (TUIT-12).
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable, Iterator
from decimal import Decimal
from typing import Any

import httpx

from tuitiontruth_pipeline.cache.base import Cache
from tuitiontruth_pipeline.canonical import ResidencyStatus, TuitionObservation
from tuitiontruth_pipeline.logging_config import get_logger
from tuitiontruth_pipeline.ratelimit import SlidingWindowRateLimiter

logger = get_logger("sources.scorecard")

RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})

# Field selection matching the columns we persist (TUIT-10 AC #2).
COST_FIELDS = (
    "id",
    "school.name",
    "latest.cost.tuition.in_state",
    "latest.cost.tuition.out_of_state",
)


class ScorecardError(RuntimeError):
    """Raised when the Scorecard API fails after exhausting retries."""


class ScorecardClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        http_client: httpx.Client,
        cache: Cache,
        rate_limiter: SlidingWindowRateLimiter,
        *,
        cache_ttl_seconds: int = 86_400,
        max_retries: int = 4,
        backoff_base_seconds: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = http_client
        self._cache = cache
        self._rate_limiter = rate_limiter
        self._ttl = cache_ttl_seconds
        self._max_retries = max_retries
        self._backoff_base = backoff_base_seconds
        self._sleep = sleep

    def _cache_key(self, path: str, params: dict[str, Any]) -> str:
        stable = json.dumps({"path": path, "params": params}, sort_keys=True)
        return f"scorecard:{stable}"

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        cache_key = self._cache_key(path, params)
        cached = self._cache.get(cache_key)
        if cached is not None:
            loaded: dict[str, Any] = json.loads(cached)
            return loaded

        url = f"{self._base_url}/{path}"
        request_params = {**params, "api_key": self._api_key}

        for attempt in range(self._max_retries + 1):
            self._rate_limiter.acquire()
            response = self._client.get(url, params=request_params)

            if response.status_code == 200:
                self._cache.set(cache_key, response.text, self._ttl)
                data: dict[str, Any] = response.json()
                return data

            if response.status_code in RETRYABLE_STATUS and attempt < self._max_retries:
                wait = self._retry_after(response, attempt)
                logger.warning(
                    "scorecard_retry",
                    extra={
                        "status": response.status_code,
                        "attempt": attempt,
                        "wait_seconds": wait,
                        "path": path,
                    },
                )
                self._sleep(wait)
                continue

            logger.error(
                "scorecard_request_failed",
                extra={"status": response.status_code, "path": path},
            )
            raise ScorecardError(f"Scorecard {path} failed with {response.status_code}")

        raise ScorecardError(f"Scorecard {path} exhausted retries")

    def _retry_after(self, response: httpx.Response, attempt: int) -> float:
        header = response.headers.get("Retry-After")
        if header is not None:
            try:
                return float(header)
            except ValueError:
                pass
        return float(self._backoff_base * (2**attempt))

    def fetch_page(self, page: int, per_page: int = 100) -> dict[str, Any]:
        """Fetch one page of institution cost records."""
        return self._get(
            "schools",
            {"fields": ",".join(COST_FIELDS), "page": page, "per_page": per_page},
        )

    def iterate_schools(self, per_page: int = 100) -> Iterator[dict[str, Any]]:
        """Yield every institution record, following pagination to completion
        (TUIT-10 AC #4)."""
        page = 0
        while True:
            payload = self._get(
                "schools",
                {"fields": ",".join(COST_FIELDS), "page": page, "per_page": per_page},
            )
            results: list[dict[str, Any]] = payload.get("results", [])
            yield from results

            metadata = payload.get("metadata", {})
            total = int(metadata.get("total", 0))
            seen = (page + 1) * per_page
            if not results or seen >= total:
                break
            page += 1

    @staticmethod
    def to_tuition_observations(
        record: dict[str, Any], academic_year: int, source_url: str
    ) -> list[TuitionObservation]:
        """Map a Scorecard record to canonical tuition observations."""
        unit_id = record.get("id")
        if unit_id is None:
            return []

        observations: list[TuitionObservation] = []
        pairs: list[tuple[ResidencyStatus, Any]] = [
            ("in_state", record.get("latest.cost.tuition.in_state")),
            ("out_of_state", record.get("latest.cost.tuition.out_of_state")),
        ]
        for residency, amount in pairs:
            if amount is None:
                continue
            observations.append(
                TuitionObservation(
                    ipeds_unit_id=int(unit_id),
                    academic_year=academic_year,
                    residency_status=residency,
                    tuition_amount=Decimal(str(amount)),
                    source_type="api",
                    source_url=source_url,
                    confidence_score=0.95,
                )
            )
        return observations
