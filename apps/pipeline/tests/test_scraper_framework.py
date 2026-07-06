import asyncio
from decimal import Decimal

import httpx

from tuitiontruth_pipeline.ratelimit import PerDomainRateLimiter
from tuitiontruth_pipeline.scrapers.config import FieldSelector, ScraperConfig
from tuitiontruth_pipeline.scrapers.framework import ScraperFramework, parse_money
from tuitiontruth_pipeline.scrapers.robots import AllowAllRobotsChecker, RobotsTxtChecker

HTML = """
<html><body>
  <div id="tuition-in-state"><span class="amount">$10,000</span></div>
  <div id="tuition-out-of-state"><span class="amount">$30,000.00</span></div>
  <div id="mandatory-fees"><span class="amount">$1,500</span></div>
</body></html>
"""


def _config() -> ScraperConfig:
    return ScraperConfig(
        ipeds_unit_id=1,
        name="Example",
        url="https://example.edu/tuition",
        academic_year=2025,
        tuition_in_state=FieldSelector(expr="#tuition-in-state .amount"),
        tuition_out_of_state=FieldSelector(expr="#tuition-out-of-state .amount"),
        mandatory_fee=FieldSelector(expr="#mandatory-fees .amount"),
    )


async def _no_sleep(_seconds: float) -> None:
    return None


def _limiter() -> PerDomainRateLimiter:
    return PerDomainRateLimiter(0.0, clock=lambda: 0.0, sleep=_no_sleep)


def test_parse_money() -> None:
    assert parse_money("$10,000.50") == Decimal("10000.50")
    assert parse_money("no digits") is None


def test_scrape_extracts_tuition_and_fees() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=HTML)

    async def run() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        framework = ScraperFramework(
            client, _limiter(), AllowAllRobotsChecker(), user_agent="Bot/1.0"
        )
        result = await framework.scrape(_config())
        await client.aclose()
        assert result.ok
        assert len(result.tuition) == 2
        assert {o.tuition_amount for o in result.tuition} == {Decimal("10000"), Decimal("30000.00")}
        assert result.fees[0].amount == Decimal("1500")

    asyncio.run(run())


def test_scrape_blocked_by_robots_returns_error_without_fetching() -> None:
    fetched = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        fetched["n"] += 1
        return httpx.Response(200, text=HTML)

    robots = RobotsTxtChecker(fetch=lambda _url: "User-agent: *\nDisallow: /")

    async def run() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        framework = ScraperFramework(client, _limiter(), robots, user_agent="Bot/1.0")
        result = await framework.scrape(_config())
        await client.aclose()
        assert not result.ok
        assert result.errors[0].reason == "blocked by robots.txt"
        assert fetched["n"] == 0

    asyncio.run(run())


def test_missing_selector_produces_structured_error_not_silent_null() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html><body>nothing here</body></html>")

    async def run() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        framework = ScraperFramework(
            client, _limiter(), AllowAllRobotsChecker(), user_agent="Bot/1.0"
        )
        result = await framework.scrape(_config())
        await client.aclose()
        assert result.tuition == []
        assert len(result.errors) == 3
        assert all("matched nothing" in e.reason for e in result.errors)

    asyncio.run(run())


def test_batch_isolates_per_config_failures() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "broken" in str(request.url):
            return httpx.Response(500, text="error")
        return httpx.Response(200, text=HTML)

    good = _config()
    broken = ScraperConfig(
        ipeds_unit_id=2,
        name="Broken",
        url="https://broken.edu/tuition",
        academic_year=2025,
        tuition_in_state=FieldSelector(expr="#tuition-in-state .amount"),
    )

    async def run() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        framework = ScraperFramework(
            client, _limiter(), AllowAllRobotsChecker(), user_agent="Bot/1.0"
        )
        results = await framework.scrape_batch([good, broken])
        await client.aclose()
        assert len(results) == 2
        assert results[0].ok
        assert not results[1].ok

    asyncio.run(run())
