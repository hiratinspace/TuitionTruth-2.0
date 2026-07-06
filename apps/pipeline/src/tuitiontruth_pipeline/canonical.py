"""Canonical ingestion schema.

Every source — the Scorecard API, IPEDS bulk files, and scrapers — normalizes
into these models before anything touches the database. They mirror the Drizzle
schema in `packages/db` and carry the same provenance fields, so a value's
origin is never lost. Money is `Decimal` (exact), never float.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ResidencyStatus = Literal["in_state", "out_of_state"]
SourceType = Literal["api", "scrape", "manual"]
FeeType = Literal["mandatory_fee", "room", "board", "books", "other"]

MIN_ACADEMIC_YEAR = 1990
MAX_ACADEMIC_YEAR = 2100


class TuitionObservation(BaseModel):
    """A single tuition figure for an institution/year/residency."""

    model_config = ConfigDict(frozen=True)

    ipeds_unit_id: int
    academic_year: int = Field(ge=MIN_ACADEMIC_YEAR, le=MAX_ACADEMIC_YEAR)
    residency_status: ResidencyStatus
    tuition_amount: Decimal = Field(gt=0)
    currency: str = "USD"
    effective_date: date | None = None
    source_type: SourceType
    source_url: str | None = None
    confidence_score: float | None = Field(default=None, ge=0, le=1)

    @property
    def key(self) -> tuple[int, int, ResidencyStatus]:
        """Natural key used for conflict resolution and diffing."""
        return (self.ipeds_unit_id, self.academic_year, self.residency_status)


class FeeObservation(BaseModel):
    """A single cost component (mandatory fee, room, board, ...)."""

    model_config = ConfigDict(frozen=True)

    ipeds_unit_id: int
    academic_year: int = Field(ge=MIN_ACADEMIC_YEAR, le=MAX_ACADEMIC_YEAR)
    fee_type: FeeType
    amount: Decimal = Field(ge=0)
    effective_date: date | None = None
    source_type: SourceType
    source_url: str | None = None


class NetPriceObservation(BaseModel):
    """Average aid and net price; amounts are optional (explicit missing data)."""

    model_config = ConfigDict(frozen=True)

    ipeds_unit_id: int
    academic_year: int = Field(ge=MIN_ACADEMIC_YEAR, le=MAX_ACADEMIC_YEAR)
    income_bracket: str | None = None
    average_aid_amount: Decimal | None = Field(default=None, ge=0)
    net_price_amount: Decimal | None = Field(default=None, ge=0)
    data_source: str | None = None
    effective_date: date | None = None
    source_type: SourceType
    source_url: str | None = None
