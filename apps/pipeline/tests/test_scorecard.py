from decimal import Decimal

import httpx

from tuitiontruth_pipeline.cache.memory import InMemoryCache
from tuitiontruth_pipeline.ratelimit import SlidingWindowRateLimiter
from tuitiontruth_pipeline.sources.scorecard import ScorecardClient, ScorecardError


def _limiter() -> SlidingWindowRateLimiter:
    return SlidingWindowRateLimiter(1000, 3600.0, clock=lambda: 0.0, sleep=lambda _s: None)


def _client(handler: httpx.MockTransport) -> ScorecardClient:
    return ScorecardClient(
        api_key="test-key",
        base_url="https://api.example/v1",
        http_client=httpx.Client(transport=handler),
        cache=InMemoryCache(clock=lambda: 0.0),
        rate_limiter=_limiter(),
        sleep=lambda _s: None,
    )


def test_maps_record_to_tuition_observations() -> None:
    record = {
        "id": 110635,
        "school.name": "Example U",
        "latest.cost.tuition.in_state": 12000,
        "latest.cost.tuition.out_of_state": 30000,
    }
    obs = ScorecardClient.to_tuition_observations(record, 2025, "https://src")
    assert len(obs) == 2
    assert obs[0].tuition_amount == Decimal("12000")
    assert obs[0].residency_status == "in_state"
    assert obs[0].source_type == "api"


def test_skips_missing_tuition_values() -> None:
    record = {"id": 1, "latest.cost.tuition.in_state": None}
    assert ScorecardClient.to_tuition_observations(record, 2025, "s") == []


def test_iterate_schools_follows_pagination() -> None:
    pages = {
        "0": {"results": [{"id": 1}, {"id": 2}], "metadata": {"total": 3, "page": 0}},
        "1": {"results": [{"id": 3}], "metadata": {"total": 3, "page": 1}},
    }

    def handler(request: httpx.Request) -> httpx.Response:
        page = request.url.params.get("page", "0")
        return httpx.Response(200, json=pages[page])

    client = _client(httpx.MockTransport(handler))
    ids = [record["id"] for record in client.iterate_schools(per_page=2)]
    assert ids == [1, 2, 3]


def test_retries_on_429_then_succeeds() -> None:
    attempts = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts["n"] += 1
        if attempts["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "0"}, json={})
        return httpx.Response(200, json={"results": [], "metadata": {"total": 0}})

    client = _client(httpx.MockTransport(handler))
    client.fetch_page(0)
    assert attempts["n"] == 2


def test_caches_successful_response() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json={"results": [], "metadata": {"total": 0}})

    client = _client(httpx.MockTransport(handler))
    client.fetch_page(0)
    client.fetch_page(0)
    assert calls["n"] == 1  # second call served from cache


def test_raises_after_exhausting_retries() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={})

    client = ScorecardClient(
        api_key="k",
        base_url="https://api.example/v1",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        cache=InMemoryCache(clock=lambda: 0.0),
        rate_limiter=_limiter(),
        max_retries=1,
        sleep=lambda _s: None,
    )
    try:
        client.fetch_page(0)
    except ScorecardError:
        return
    raise AssertionError("expected ScorecardError")
