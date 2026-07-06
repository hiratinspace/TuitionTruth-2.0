"""Generic web scraper framework (TUIT-13).

Plugs per-institution configs (TUIT-14) into a reusable engine: robots.txt
respected by default, per-domain rate limiting, CSS/XPath extraction, structured
errors (never silent nulls), canonical output, and source_url + timestamp logged
for every extraction (feeding the audit trail). Batch scraping is concurrent
across domains but polite within each.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Protocol
from urllib.parse import urlsplit

import httpx
from lxml import html as lxml_html

from tuitiontruth_pipeline.canonical import FeeObservation, ResidencyStatus, TuitionObservation
from tuitiontruth_pipeline.logging_config import get_logger
from tuitiontruth_pipeline.ratelimit import PerDomainRateLimiter
from tuitiontruth_pipeline.scrapers.config import FieldSelector, ScraperConfig

logger = get_logger("scrapers.framework")

_MONEY_RE = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")


class RobotsChecker(Protocol):
    def is_allowed(self, url: str, user_agent: str) -> bool: ...


@dataclass
class ExtractionError:
    field_name: str
    reason: str


@dataclass
class ScrapeResult:
    config: ScraperConfig
    source_url: str
    fetched_at: datetime
    tuition: list[TuitionObservation] = field(default_factory=list)
    fees: list[FeeObservation] = field(default_factory=list)
    errors: list[ExtractionError] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def parse_money(text: str) -> Decimal | None:
    """Extract the first monetary figure from arbitrary text."""
    match = _MONEY_RE.search(text)
    if match is None:
        return None
    try:
        return Decimal(match.group(0).replace(",", ""))
    except InvalidOperation:
        return None


def extract_raw(doc: lxml_html.HtmlElement, selector: FieldSelector) -> str | None:
    """Apply a selector to the parsed document and return the raw string."""
    nodes = doc.cssselect(selector.expr) if selector.type == "css" else doc.xpath(selector.expr)
    if not nodes:
        return None
    node = nodes[0]
    if isinstance(node, str):
        raw = node
    elif selector.attribute is not None:
        raw = node.get(selector.attribute) or ""
    else:
        raw = node.text_content()
    if selector.regex is not None:
        match = re.search(selector.regex, raw)
        if match is None:
            return None
        raw = match.group(1) if match.groups() else match.group(0)
    return raw


class ScraperFramework:
    def __init__(
        self,
        http_client: httpx.AsyncClient,
        rate_limiter: PerDomainRateLimiter,
        robots_checker: RobotsChecker,
        *,
        user_agent: str,
        max_concurrency: int = 50,
    ) -> None:
        self._client = http_client
        self._rate_limiter = rate_limiter
        self._robots = robots_checker
        self._user_agent = user_agent
        self._semaphore = asyncio.Semaphore(max_concurrency)

    async def scrape(self, config: ScraperConfig) -> ScrapeResult:
        fetched_at = datetime.now(UTC)
        result = ScrapeResult(config=config, source_url=config.url, fetched_at=fetched_at)

        if config.respect_robots and not self._robots.is_allowed(config.url, self._user_agent):
            result.errors.append(ExtractionError("_page", "blocked by robots.txt"))
            logger.warning("scrape_blocked_by_robots", extra={"url": config.url})
            return result

        domain = urlsplit(config.url).netloc
        await self._rate_limiter.acquire(domain)

        try:
            response = await self._client.get(config.url, headers={"User-Agent": self._user_agent})
            response.raise_for_status()
        except httpx.HTTPError as exc:
            result.errors.append(ExtractionError("_page", f"fetch failed: {exc}"))
            logger.warning("scrape_fetch_failed", extra={"url": config.url, "error": str(exc)})
            return result

        doc = lxml_html.fromstring(response.text)
        self._extract_tuition(doc, config, "in_state", config.tuition_in_state, result)
        self._extract_tuition(doc, config, "out_of_state", config.tuition_out_of_state, result)
        self._extract_fee(doc, config, result)

        logger.info(
            "scrape_complete",
            extra={
                "url": config.url,
                "fetched_at": fetched_at.isoformat(),
                "tuition_count": len(result.tuition),
                "fee_count": len(result.fees),
                "error_count": len(result.errors),
            },
        )
        return result

    def _extract_tuition(
        self,
        doc: lxml_html.HtmlElement,
        config: ScraperConfig,
        residency: ResidencyStatus,
        selector: FieldSelector | None,
        result: ScrapeResult,
    ) -> None:
        if selector is None:
            return
        field_name = f"tuition_{residency}"
        raw = extract_raw(doc, selector)
        if raw is None:
            result.errors.append(ExtractionError(field_name, "selector matched nothing"))
            return
        amount = parse_money(raw)
        if amount is None or amount <= 0:
            result.errors.append(ExtractionError(field_name, f"unparseable amount: {raw!r}"))
            return
        result.tuition.append(
            TuitionObservation(
                ipeds_unit_id=config.ipeds_unit_id,
                academic_year=config.academic_year,
                residency_status=residency,
                tuition_amount=amount,
                source_type="scrape",
                source_url=config.url,
                confidence_score=0.85,
            )
        )

    def _extract_fee(
        self, doc: lxml_html.HtmlElement, config: ScraperConfig, result: ScrapeResult
    ) -> None:
        if config.mandatory_fee is None:
            return
        raw = extract_raw(doc, config.mandatory_fee)
        if raw is None:
            result.errors.append(ExtractionError("mandatory_fee", "selector matched nothing"))
            return
        amount = parse_money(raw)
        if amount is None or amount < 0:
            result.errors.append(ExtractionError("mandatory_fee", f"unparseable amount: {raw!r}"))
            return
        result.fees.append(
            FeeObservation(
                ipeds_unit_id=config.ipeds_unit_id,
                academic_year=config.academic_year,
                fee_type="mandatory_fee",
                amount=amount,
                source_type="scrape",
                source_url=config.url,
            )
        )

    async def scrape_batch(self, configs: list[ScraperConfig]) -> list[ScrapeResult]:
        """Scrape many institutions concurrently (bounded), each domain polite.
        A single failing config never blocks the others (TUIT-15)."""

        async def _guarded(config: ScraperConfig) -> ScrapeResult:
            async with self._semaphore:
                try:
                    return await self.scrape(config)
                except Exception as exc:
                    logger.error(
                        "scrape_unexpected_error",
                        extra={"url": config.url, "error": str(exc)},
                    )
                    return ScrapeResult(
                        config=config,
                        source_url=config.url,
                        fetched_at=datetime.now(UTC),
                        errors=[ExtractionError("_page", f"unexpected: {exc}")],
                    )

        return await asyncio.gather(*(_guarded(c) for c in configs))
