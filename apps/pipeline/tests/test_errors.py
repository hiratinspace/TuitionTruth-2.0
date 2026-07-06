import httpx

from tuitiontruth_pipeline.orchestration.errors import (
    ConsoleAlerter,
    PipelineError,
    SlackAlerter,
    ThrottlingAlerter,
)


class RecordingAlerter:
    def __init__(self) -> None:
        self.sent: list[PipelineError] = []

    def send(self, error: PipelineError) -> None:
        self.sent.append(error)


def test_throttle_suppresses_duplicate_within_window() -> None:
    now = {"t": 0.0}
    inner = RecordingAlerter()
    throttle = ThrottlingAlerter(inner, window_seconds=300.0, clock=lambda: now["t"])
    error = PipelineError("etl", "scorecard", "critical", "boom")
    throttle.send(error)
    throttle.send(error)
    assert len(inner.sent) == 1
    assert throttle.suppressed_count == 1


def test_throttle_allows_after_window() -> None:
    now = {"t": 0.0}
    inner = RecordingAlerter()
    throttle = ThrottlingAlerter(inner, window_seconds=300.0, clock=lambda: now["t"])
    error = PipelineError("etl", "scorecard", "critical", "boom")
    throttle.send(error)
    now["t"] = 301.0
    throttle.send(error)
    assert len(inner.sent) == 2


def test_slack_posts_only_critical() -> None:
    posts: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        posts.append(request)
        return httpx.Response(200)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    alerter = SlackAlerter("https://hooks.example/x", client)
    alerter.send(PipelineError("etl", "scraper", "warning", "minor"))
    alerter.send(PipelineError("etl", "scraper", "critical", "major"))
    client.close()
    assert len(posts) == 1


def test_console_alerter_does_not_raise() -> None:
    ConsoleAlerter().send(PipelineError("etl", "scraper", "warning", "minor"))
