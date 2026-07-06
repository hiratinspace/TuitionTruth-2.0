"""robots.txt compliance (TUIT-13 AC #2).

The default posture is to respect robots.txt. Overriding it is opt-in per config
and, per policy, requires manual approval. The checker takes an injected fetch
function so it is testable offline and can be backed by httpx in production.
"""

from __future__ import annotations

from collections.abc import Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser


class AllowAllRobotsChecker:
    """Used only when a config's robots override has been manually approved."""

    def is_allowed(self, url: str, user_agent: str) -> bool:
        return True


class RobotsTxtChecker:
    """Fetches and caches robots.txt per origin, then answers allow/deny."""

    def __init__(self, fetch: Callable[[str], str | None]) -> None:
        self._fetch = fetch
        self._parsers: dict[str, RobotFileParser | None] = {}

    def _parser_for(self, origin: str) -> RobotFileParser | None:
        if origin not in self._parsers:
            content = self._fetch(f"{origin}/robots.txt")
            if content is None:
                # No robots.txt reachable → conservative default is to allow,
                # matching standard crawler behavior for a missing file.
                self._parsers[origin] = None
            else:
                parser = RobotFileParser()
                parser.parse(content.splitlines())
                self._parsers[origin] = parser
        return self._parsers[origin]

    def is_allowed(self, url: str, user_agent: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        parser = self._parser_for(origin)
        if parser is None:
            return True
        return parser.can_fetch(user_agent, url)
