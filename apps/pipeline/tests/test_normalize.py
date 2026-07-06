from decimal import Decimal

from tuitiontruth_pipeline.canonical import SourceType, TuitionObservation
from tuitiontruth_pipeline.etl.normalize import normalize, resolve_tuition


def _obs(source: SourceType, confidence: float, amount: str) -> TuitionObservation:
    return TuitionObservation(
        ipeds_unit_id=1,
        academic_year=2024,
        residency_status="in_state",
        tuition_amount=Decimal(amount),
        source_type=source,
        confidence_score=confidence,
    )


def test_scrape_beats_api() -> None:
    resolved = resolve_tuition([_obs("api", 0.95, "10000"), _obs("scrape", 0.85, "11000")])
    assert len(resolved) == 1
    assert resolved[0].source_type == "scrape"


def test_manual_beats_scrape() -> None:
    resolved = resolve_tuition([_obs("scrape", 0.85, "11000"), _obs("manual", 0.99, "10500")])
    assert resolved[0].source_type == "manual"


def test_higher_confidence_wins_within_same_source() -> None:
    resolved = resolve_tuition([_obs("api", 0.80, "9000"), _obs("api", 0.95, "9500")])
    assert resolved[0].tuition_amount == Decimal("9500")


def test_resolution_is_idempotent() -> None:
    observations = [_obs("api", 0.95, "10000"), _obs("scrape", 0.85, "11000")]
    assert resolve_tuition(observations) == resolve_tuition(resolve_tuition(observations))


def test_normalize_returns_all_record_types() -> None:
    data = normalize(tuition=[_obs("api", 0.95, "10000")])
    assert len(data.tuition) == 1
    assert data.fees == []
    assert data.net_price == []
