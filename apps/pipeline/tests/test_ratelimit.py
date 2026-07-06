import asyncio

from tuitiontruth_pipeline.ratelimit import PerDomainRateLimiter, SlidingWindowRateLimiter


def test_sliding_window_allows_up_to_limit_without_sleeping() -> None:
    slept: list[float] = []
    limiter = SlidingWindowRateLimiter(
        max_calls=2, period_seconds=10.0, clock=lambda: 0.0, sleep=slept.append
    )
    limiter.acquire()
    limiter.acquire()
    assert slept == []


def test_sliding_window_sleeps_when_exceeded() -> None:
    slept: list[float] = []
    limiter = SlidingWindowRateLimiter(
        max_calls=2, period_seconds=10.0, clock=lambda: 0.0, sleep=slept.append
    )
    limiter.acquire()
    limiter.acquire()
    limiter.acquire()
    assert slept == [10.0]


def test_per_domain_spaces_repeat_requests() -> None:
    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    limiter = PerDomainRateLimiter(min_interval_seconds=10.0, clock=lambda: 0.0, sleep=fake_sleep)

    async def run() -> None:
        await limiter.acquire("a.edu")
        await limiter.acquire("a.edu")

    asyncio.run(run())
    assert slept == [10.0]


def test_per_domain_does_not_delay_distinct_domains() -> None:
    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    limiter = PerDomainRateLimiter(min_interval_seconds=10.0, clock=lambda: 0.0, sleep=fake_sleep)

    async def run() -> None:
        await limiter.acquire("a.edu")
        await limiter.acquire("b.edu")

    asyncio.run(run())
    assert slept == []
