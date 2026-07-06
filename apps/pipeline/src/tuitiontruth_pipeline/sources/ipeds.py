"""IPEDS bulk data import connector (TUIT-11).

Parses an IPEDS Institutional Characteristics (IC) flat file into canonical
tuition observations. Column mapping is documented in docs/data-dictionary.md.
Parsing is pure and deterministic, so re-running on the same file yields
identical observations; idempotency at the row level is guaranteed by the
database unique constraint (institution, year, residency) on write.

Provisional releases are tagged with a lower confidence score than final ones,
which is how the "provisional vs. final" distinction survives into the model.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from tuitiontruth_pipeline.canonical import ResidencyStatus, TuitionObservation
from tuitiontruth_pipeline.logging_config import get_logger

logger = get_logger("sources.ipeds")

# IPEDS IC-AY tuition columns → canonical residency (docs/data-dictionary.md).
COLUMN_MAP: dict[str, ResidencyStatus] = {
    "TUITION2": "in_state",
    "TUITION3": "out_of_state",
}

PROVISIONAL_CONFIDENCE = 0.80
FINAL_CONFIDENCE = 0.95


@dataclass
class ImportSummary:
    """Report produced by every import run (TUIT-11 AC #5)."""

    rows_processed: int = 0
    rows_rejected: int = 0
    observations_created: int = 0
    errors: list[str] = field(default_factory=list)


@dataclass
class ImportResult:
    observations: list[TuitionObservation]
    summary: ImportSummary


class IpedsTuitionConnector:
    def __init__(self, *, provisional: bool = False) -> None:
        self._provisional = provisional
        self._confidence = PROVISIONAL_CONFIDENCE if provisional else FINAL_CONFIDENCE

    def parse(self, csv_text: str, academic_year: int, source_url: str) -> ImportResult:
        reader = csv.DictReader(io.StringIO(csv_text))
        observations: list[TuitionObservation] = []
        summary = ImportSummary()

        for row in reader:
            summary.rows_processed += 1
            raw_unit = (row.get("UNITID") or "").strip()
            if not raw_unit.isdigit():
                summary.rows_rejected += 1
                summary.errors.append(f"invalid UNITID: {raw_unit!r}")
                continue
            unit_id = int(raw_unit)

            row_had_value = False
            for column, residency in COLUMN_MAP.items():
                amount = self._parse_amount(row.get(column))
                if amount is None:
                    continue
                row_had_value = True
                observations.append(
                    TuitionObservation(
                        ipeds_unit_id=unit_id,
                        academic_year=academic_year,
                        residency_status=residency,
                        tuition_amount=amount,
                        source_type="api",
                        source_url=source_url,
                        confidence_score=self._confidence,
                    )
                )
            if not row_had_value:
                summary.rows_rejected += 1
                summary.errors.append(f"UNITID {unit_id}: no usable tuition columns")

        summary.observations_created = len(observations)
        logger.info(
            "ipeds_import_complete",
            extra={
                "academic_year": academic_year,
                "provisional": self._provisional,
                "rows_processed": summary.rows_processed,
                "rows_rejected": summary.rows_rejected,
                "observations": summary.observations_created,
            },
        )
        return ImportResult(observations=observations, summary=summary)

    @staticmethod
    def _parse_amount(raw: str | None) -> Decimal | None:
        if raw is None:
            return None
        cleaned = raw.strip().replace(",", "").replace("$", "")
        if cleaned == "" or cleaned == ".":
            return None
        try:
            value = Decimal(cleaned)
        except InvalidOperation:
            return None
        return value if value > 0 else None
