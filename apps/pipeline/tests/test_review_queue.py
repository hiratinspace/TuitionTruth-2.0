from datetime import UTC, datetime
from decimal import Decimal

import pytest

from tuitiontruth_pipeline.quality.diffing import PendingChange
from tuitiontruth_pipeline.quality.review_queue import (
    InMemoryPendingChangeStore,
    ReviewFilter,
    ReviewQueueService,
)


class RecordingWriter:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def apply_tuition(
        self,
        *,
        ipeds_unit_id: int,
        academic_year: int,
        residency_status: str,
        tuition_amount: Decimal,
        source_url: str | None,
        confidence_score: float | None,
        reviewer: str,
    ) -> None:
        self.calls.append(
            {
                "ipeds_unit_id": ipeds_unit_id,
                "tuition_amount": tuition_amount,
                "reviewer": reviewer,
            }
        )


def _change(unit_id: int = 1) -> PendingChange:
    return PendingChange(
        kind="update",
        table_name="tuition_rates",
        ipeds_unit_id=unit_id,
        academic_year=2024,
        residency_status="in_state",
        field_changed="tuition_amount",
        old_value=Decimal("10000"),
        new_value=Decimal("11000"),
        source_url="https://src",
        confidence_score=0.85,
        explanation="+10.0% vs current value 10000",
        detected_at=datetime.now(UTC),
    )


def _service() -> tuple[ReviewQueueService, RecordingWriter]:
    writer = RecordingWriter()
    return ReviewQueueService(InMemoryPendingChangeStore(), writer), writer


def test_approve_commits_value_and_marks_approved() -> None:
    service, writer = _service()
    item = service.enqueue(_change())
    approved = service.approve(item.id, reviewer="alice")
    assert approved.status == "approved"
    assert approved.reviewer == "alice"
    assert writer.calls == [
        {"ipeds_unit_id": 1, "tuition_amount": Decimal("11000"), "reviewer": "alice"},
    ]


def test_reject_archives_with_reason_without_committing() -> None:
    service, writer = _service()
    item = service.enqueue(_change())
    rejected = service.reject(item.id, reviewer="bob", reason="looks like a scraper glitch")
    assert rejected.status == "rejected"
    assert rejected.rejection_reason == "looks like a scraper glitch"
    assert writer.calls == []


def test_cannot_resolve_twice() -> None:
    service, _ = _service()
    item = service.enqueue(_change())
    service.approve(item.id, reviewer="alice")
    with pytest.raises(ValueError, match="already approved"):
        service.approve(item.id, reviewer="alice")


def test_list_pending_filters_by_institution() -> None:
    service, _ = _service()
    service.enqueue(_change(unit_id=1))
    service.enqueue(_change(unit_id=2))
    pending = service.list_pending(ReviewFilter(ipeds_unit_id=2))
    assert len(pending) == 1
    assert pending[0].change.ipeds_unit_id == 2
