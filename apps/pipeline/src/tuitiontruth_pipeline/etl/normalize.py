"""Canonical normalization + conflict resolution (TUIT-16).

Takes observations from any mix of sources and resolves conflicts for the same
(institution, year, residency) key using documented precedence rules. The
resolution is deterministic, so re-running is idempotent (AC #4).

Precedence (highest wins):
  1. `manual`  — human QA-approved corrections
  2. `scrape`  — current-year sticker price scraped from the bursar page
  3. `api`     — federal data (Scorecard / IPEDS), which lags 1-2 years
Ties within a rank break on higher confidence score, then on presence of an
effective date (a dated record beats an undated one).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from tuitiontruth_pipeline.canonical import (
    FeeObservation,
    NetPriceObservation,
    SourceType,
    TuitionObservation,
)

_SOURCE_RANK: dict[SourceType, int] = {"manual": 3, "scrape": 2, "api": 1}


def _tuition_rank(obs: TuitionObservation) -> tuple[int, float, int]:
    return (
        _SOURCE_RANK[obs.source_type],
        obs.confidence_score or 0.0,
        1 if obs.effective_date is not None else 0,
    )


@dataclass
class NormalizedData:
    tuition: list[TuitionObservation]
    fees: list[FeeObservation]
    net_price: list[NetPriceObservation]


def resolve_tuition(observations: Iterable[TuitionObservation]) -> list[TuitionObservation]:
    """Collapse conflicting tuition observations to one winner per natural key."""
    best: dict[tuple[int, int, str], TuitionObservation] = {}
    for obs in observations:
        existing = best.get(obs.key)
        if existing is None or _tuition_rank(obs) > _tuition_rank(existing):
            best[obs.key] = obs
    return sorted(best.values(), key=lambda o: o.key)


def resolve_fees(observations: Iterable[FeeObservation]) -> list[FeeObservation]:
    """One fee row per (institution, year, fee_type); later source rank wins."""
    best: dict[tuple[int, int, str], FeeObservation] = {}
    for obs in observations:
        key = (obs.ipeds_unit_id, obs.academic_year, obs.fee_type)
        existing = best.get(key)
        if existing is None or _SOURCE_RANK[obs.source_type] >= _SOURCE_RANK[existing.source_type]:
            best[key] = obs
    return sorted(best.values(), key=lambda o: (o.ipeds_unit_id, o.academic_year, o.fee_type))


def resolve_net_price(observations: Iterable[NetPriceObservation]) -> list[NetPriceObservation]:
    """One net-price row per (institution, year, income_bracket)."""
    best: dict[tuple[int, int, str], NetPriceObservation] = {}
    for obs in observations:
        key = (obs.ipeds_unit_id, obs.academic_year, obs.income_bracket or "")
        existing = best.get(key)
        if existing is None or _SOURCE_RANK[obs.source_type] >= _SOURCE_RANK[existing.source_type]:
            best[key] = obs
    return sorted(
        best.values(),
        key=lambda o: (o.ipeds_unit_id, o.academic_year, o.income_bracket or ""),
    )


def normalize(
    tuition: Iterable[TuitionObservation] = (),
    fees: Iterable[FeeObservation] = (),
    net_price: Iterable[NetPriceObservation] = (),
) -> NormalizedData:
    """Normalize a full batch across all record types."""
    return NormalizedData(
        tuition=resolve_tuition(tuition),
        fees=resolve_fees(fees),
        net_price=resolve_net_price(net_price),
    )
