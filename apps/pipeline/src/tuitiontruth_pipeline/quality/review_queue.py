"""Manual QA review queue (TUIT-18).

Flagged changes from the diffing engine land here as `pending` items. A human
operator approves or rejects each. Approval commits the value to the canonical
tables (attributed to the reviewer, so the audit trigger records `manual`) and
marks the item `approved`; rejection archives the item with a reason. Nothing is
ever hard-deleted.

The service is written against storage/writer Protocols so its logic is unit-
testable with in-memory fakes; production wires the psycopg-backed implementations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal, Protocol

from tuitiontruth_pipeline.quality.diffing import PendingChange

ReviewStatus = Literal["pending", "approved", "rejected"]


@dataclass
class ReviewItem:
    id: int
    change: PendingChange
    status: ReviewStatus = "pending"
    reviewer: str | None = None
    rejection_reason: str | None = None
    resolved_at: datetime | None = None


@dataclass
class ReviewFilter:
    ipeds_unit_id: int | None = None
    field_changed: str | None = None
    status: ReviewStatus = "pending"


class PendingChangeStore(Protocol):
    """Persistence for review items."""

    def add(self, change: PendingChange) -> ReviewItem: ...

    def get(self, item_id: int) -> ReviewItem | None: ...

    def list(self, where: ReviewFilter) -> list[ReviewItem]: ...

    def update(self, item: ReviewItem) -> None: ...


class CanonicalWriter(Protocol):
    """Commits an approved value into the canonical tables, attributed to the
    reviewer so the audit trigger records the change as `manual`."""

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
    ) -> None: ...


@dataclass
class InMemoryPendingChangeStore:
    """Test/dev implementation of `PendingChangeStore`."""

    _items: dict[int, ReviewItem] = field(default_factory=dict)
    _next_id: int = 1

    def add(self, change: PendingChange) -> ReviewItem:
        item = ReviewItem(id=self._next_id, change=change)
        self._items[self._next_id] = item
        self._next_id += 1
        return item

    def get(self, item_id: int) -> ReviewItem | None:
        return self._items.get(item_id)

    def list(self, where: ReviewFilter) -> list[ReviewItem]:
        results = [i for i in self._items.values() if i.status == where.status]
        if where.ipeds_unit_id is not None:
            results = [i for i in results if i.change.ipeds_unit_id == where.ipeds_unit_id]
        if where.field_changed is not None:
            results = [i for i in results if i.change.field_changed == where.field_changed]
        return sorted(results, key=lambda i: i.id)

    def update(self, item: ReviewItem) -> None:
        self._items[item.id] = item


class ReviewQueueService:
    def __init__(self, store: PendingChangeStore, writer: CanonicalWriter) -> None:
        self._store = store
        self._writer = writer

    def enqueue(self, change: PendingChange) -> ReviewItem:
        return self._store.add(change)

    def list_pending(self, where: ReviewFilter | None = None) -> list[ReviewItem]:
        return self._store.list(where or ReviewFilter())

    def approve(self, item_id: int, reviewer: str) -> ReviewItem:
        item = self._require(item_id)
        change = item.change
        self._writer.apply_tuition(
            ipeds_unit_id=change.ipeds_unit_id,
            academic_year=change.academic_year,
            residency_status=change.residency_status,
            tuition_amount=change.new_value,
            source_url=change.source_url,
            confidence_score=change.confidence_score,
            reviewer=reviewer,
        )
        item.status = "approved"
        item.reviewer = reviewer
        item.resolved_at = datetime.now(UTC)
        self._store.update(item)
        return item

    def reject(self, item_id: int, reviewer: str, reason: str) -> ReviewItem:
        item = self._require(item_id)
        item.status = "rejected"
        item.reviewer = reviewer
        item.rejection_reason = reason
        item.resolved_at = datetime.now(UTC)
        self._store.update(item)
        return item

    def _require(self, item_id: int) -> ReviewItem:
        item = self._store.get(item_id)
        if item is None:
            raise KeyError(f"review item {item_id} not found")
        if item.status != "pending":
            raise ValueError(f"review item {item_id} already {item.status}")
        return item
