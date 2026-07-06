"""Change-detection & diffing engine (TUIT-17).

Newly ingested tuition figures are NOT written live. Each is compared against
the current stored value; a substantive change produces a `PendingChange` bound
for the human QA queue, never a direct production write. Because amounts are
canonicalized to `Decimal` before comparison, pure formatting differences
("10000" vs "10,000.00") produce no change. A configurable tolerance suppresses
economically trivial deltas.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal, Protocol

from tuitiontruth_pipeline.canonical import TuitionObservation

ChangeKind = Literal["new", "update"]


class CurrentValueStore(Protocol):
    """Supplies the current live tuition amount for a natural key, or None if
    the institution/year/residency has no record yet."""

    def get_current_tuition(self, key: tuple[int, int, str]) -> Decimal | None: ...


@dataclass(frozen=True)
class PendingChange:
    kind: ChangeKind
    table_name: str
    ipeds_unit_id: int
    academic_year: int
    residency_status: str
    field_changed: str
    old_value: Decimal | None
    new_value: Decimal
    source_url: str | None
    confidence_score: float | None
    explanation: str
    detected_at: datetime


def _is_substantive(old: Decimal, new: Decimal, min_abs: Decimal, min_rel: float) -> bool:
    delta = abs(new - old)
    if delta < min_abs:
        return False
    return not (old != 0 and (delta / abs(old)) < Decimal(str(min_rel)))


def detect_tuition_changes(
    observations: list[TuitionObservation],
    store: CurrentValueStore,
    *,
    min_absolute: Decimal = Decimal("0"),
    min_relative: float = 0.0,
) -> list[PendingChange]:
    """Return one pending change per new-or-substantively-changed observation."""
    now = datetime.now(UTC)
    changes: list[PendingChange] = []
    for obs in observations:
        current = store.get_current_tuition(obs.key)
        if current is None:
            changes.append(_make_change("new", obs, None, "new record", now))
            continue
        if current == obs.tuition_amount:
            continue
        if not _is_substantive(current, obs.tuition_amount, min_absolute, min_relative):
            continue
        pct = (obs.tuition_amount - current) / current * 100 if current != 0 else Decimal("0")
        explanation = f"{pct:+.1f}% vs current value {current}"
        changes.append(_make_change("update", obs, current, explanation, now))
    return changes


def _make_change(
    kind: ChangeKind,
    obs: TuitionObservation,
    old: Decimal | None,
    explanation: str,
    now: datetime,
) -> PendingChange:
    return PendingChange(
        kind=kind,
        table_name="tuition_rates",
        ipeds_unit_id=obs.ipeds_unit_id,
        academic_year=obs.academic_year,
        residency_status=obs.residency_status,
        field_changed="tuition_amount",
        old_value=old,
        new_value=obs.tuition_amount,
        source_url=obs.source_url,
        confidence_score=obs.confidence_score,
        explanation=explanation,
        detected_at=now,
    )
