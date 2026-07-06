from decimal import Decimal

from tuitiontruth_pipeline.sources.ipeds import (
    FINAL_CONFIDENCE,
    PROVISIONAL_CONFIDENCE,
    IpedsTuitionConnector,
)

CSV = (
    "UNITID,INSTNM,TUITION2,TUITION3\n110635,Example U,12000,30000\n999999,Bad U,,\nabc,Junk,1,2\n"
)


def test_parses_valid_rows_into_observations() -> None:
    result = IpedsTuitionConnector().parse(CSV, academic_year=2024, source_url="https://ipeds")
    assert result.summary.observations_created == 2
    amounts = sorted(o.tuition_amount for o in result.observations)
    assert amounts == [Decimal("12000"), Decimal("30000")]


def test_rejects_rows_without_usable_columns() -> None:
    result = IpedsTuitionConnector().parse(CSV, academic_year=2024, source_url="https://ipeds")
    # Row 999999 has no tuition; row "abc" has an invalid UNITID.
    assert result.summary.rows_rejected == 2
    assert result.summary.rows_processed == 3


def test_provisional_flag_lowers_confidence() -> None:
    final = IpedsTuitionConnector(provisional=False).parse(CSV, 2024, "s")
    provisional = IpedsTuitionConnector(provisional=True).parse(CSV, 2024, "s")
    assert final.observations[0].confidence_score == FINAL_CONFIDENCE
    assert provisional.observations[0].confidence_score == PROVISIONAL_CONFIDENCE


def test_import_is_deterministic() -> None:
    a = IpedsTuitionConnector().parse(CSV, 2024, "s")
    b = IpedsTuitionConnector().parse(CSV, 2024, "s")
    assert a.observations == b.observations
