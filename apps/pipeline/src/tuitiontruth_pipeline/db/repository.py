"""psycopg-backed persistence (production wiring for TUIT-16/17/18).

`CanonicalWriterPg` commits approved values into the canonical tables inside a
transaction that sets `app.actor = 'manual'`, so the database audit trigger
records the change with the correct provenance. `CurrentValueStorePg` supplies
the diffing engine's baseline, and `PendingChangeStorePg` persists the QA queue.

The SQL these classes issue is the same shape validated by the TypeScript
integration suite in packages/db; the QA orchestration logic is unit-tested with
in-memory fakes in tests/.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from tuitiontruth_pipeline.quality.diffing import ChangeKind, PendingChange
from tuitiontruth_pipeline.quality.review_queue import ReviewFilter, ReviewItem, ReviewStatus

if TYPE_CHECKING:
    from psycopg import Connection


class MissingInstitutionError(RuntimeError):
    """Raised when a write references an ipeds_unit_id with no institution row."""


class CurrentValueStorePg:
    """Reads the current live tuition amount for the diffing engine (TUIT-17)."""

    def __init__(self, conn: Connection[tuple[object, ...]]) -> None:
        self._conn = conn

    def get_current_tuition(self, key: tuple[int, int, str]) -> Decimal | None:
        unit_id, year, residency = key
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT t.tuition_amount
                FROM tuition_rates t
                JOIN institutions i ON i.id = t.institution_id
                WHERE i.ipeds_unit_id = %s
                  AND t.academic_year = %s
                  AND t.residency_status = %s::residency_status
                """,
                (unit_id, year, residency),
            )
            row = cur.fetchone()
        if row is None or row[0] is None:
            return None
        return Decimal(str(row[0]))


class CanonicalWriterPg:
    """Commits an approved tuition value, attributed to `manual` (TUIT-18)."""

    def __init__(self, conn: Connection[tuple[object, ...]]) -> None:
        self._conn = conn

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
        with self._conn.transaction(), self._conn.cursor() as cur:
            cur.execute("SET LOCAL app.actor = 'manual'")
            cur.execute(
                "SELECT id FROM institutions WHERE ipeds_unit_id = %s",
                (ipeds_unit_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise MissingInstitutionError(f"no institution with ipeds_unit_id={ipeds_unit_id}")
            institution_id = int(str(row[0]))
            cur.execute(
                """
                INSERT INTO tuition_rates
                    (institution_id, academic_year, residency_status,
                     tuition_amount, source_type, source_url, confidence_score)
                VALUES (%s, %s, %s::residency_status, %s, 'manual'::source_type, %s, %s)
                ON CONFLICT (institution_id, academic_year, residency_status)
                DO UPDATE SET
                    tuition_amount = EXCLUDED.tuition_amount,
                    source_type = 'manual'::source_type,
                    source_url = EXCLUDED.source_url,
                    confidence_score = EXCLUDED.confidence_score
                """,
                (
                    institution_id,
                    academic_year,
                    residency_status,
                    tuition_amount,
                    source_url,
                    confidence_score,
                ),
            )


class PendingChangeStorePg:
    """Persists QA review items in the `pending_changes` table (TUIT-18)."""

    def __init__(self, conn: Connection[tuple[object, ...]]) -> None:
        self._conn = conn

    def add(self, change: PendingChange) -> ReviewItem:
        with self._conn.transaction(), self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO pending_changes
                    (kind, table_name, ipeds_unit_id, academic_year, residency_status,
                     field_changed, old_value, new_value, source_url, confidence_score,
                     explanation, detected_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    change.kind,
                    change.table_name,
                    change.ipeds_unit_id,
                    change.academic_year,
                    change.residency_status,
                    change.field_changed,
                    change.old_value,
                    change.new_value,
                    change.source_url,
                    change.confidence_score,
                    change.explanation,
                    change.detected_at,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise RuntimeError("insert into pending_changes returned no id")
            return ReviewItem(id=int(str(row[0])), change=change)

    def get(self, item_id: int) -> ReviewItem | None:
        with self._conn.cursor() as cur:
            cur.execute("SELECT * FROM pending_changes WHERE id = %s", (item_id,))
            row = cur.fetchone()
            names = [d.name for d in cur.description] if cur.description else []
        if row is None:
            return None
        return self._to_item(dict(zip(names, row, strict=False)))

    def list(self, where: ReviewFilter) -> list[ReviewItem]:
        clauses = ["status = %s"]
        params: list[object] = [where.status]
        if where.ipeds_unit_id is not None:
            clauses.append("ipeds_unit_id = %s")
            params.append(where.ipeds_unit_id)
        if where.field_changed is not None:
            clauses.append("field_changed = %s")
            params.append(where.field_changed)
        query = f"SELECT * FROM pending_changes WHERE {' AND '.join(clauses)} ORDER BY id"
        with self._conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            names = [d.name for d in cur.description] if cur.description else []
        return [self._to_item(dict(zip(names, row, strict=False))) for row in rows]

    def update(self, item: ReviewItem) -> None:
        with self._conn.transaction(), self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pending_changes
                SET status = %s, reviewer = %s, rejection_reason = %s, resolved_at = %s
                WHERE id = %s
                """,
                (item.status, item.reviewer, item.rejection_reason, item.resolved_at, item.id),
            )

    @staticmethod
    def _to_item(row: dict[str, object]) -> ReviewItem:
        old_value = row["old_value"]
        change = PendingChange(
            kind=_as_change_kind(row["kind"]),
            table_name=str(row["table_name"]),
            ipeds_unit_id=int(str(row["ipeds_unit_id"])),
            academic_year=int(str(row["academic_year"])),
            residency_status=str(row["residency_status"]),
            field_changed=str(row["field_changed"]),
            old_value=Decimal(str(old_value)) if old_value is not None else None,
            new_value=Decimal(str(row["new_value"])),
            source_url=str(row["source_url"]) if row["source_url"] is not None else None,
            confidence_score=(
                float(str(row["confidence_score"])) if row["confidence_score"] is not None else None
            ),
            explanation=str(row["explanation"]),
            detected_at=_as_datetime(row["detected_at"]),
        )
        resolved = row["resolved_at"]
        return ReviewItem(
            id=int(str(row["id"])),
            change=change,
            status=_as_status(row["status"]),
            reviewer=str(row["reviewer"]) if row["reviewer"] is not None else None,
            rejection_reason=(
                str(row["rejection_reason"]) if row["rejection_reason"] is not None else None
            ),
            resolved_at=_as_datetime(resolved) if resolved is not None else None,
        )


def _as_change_kind(value: object) -> ChangeKind:
    if value == "new":
        return "new"
    if value == "update":
        return "update"
    raise ValueError(f"unexpected change kind: {value!r}")


def _as_status(value: object) -> ReviewStatus:
    if value == "pending":
        return "pending"
    if value == "approved":
        return "approved"
    if value == "rejected":
        return "rejected"
    raise ValueError(f"unexpected status: {value!r}")


def _as_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    raise TypeError(f"expected datetime, got {type(value)!r}")
