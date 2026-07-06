from decimal import Decimal

from tuitiontruth_pipeline.canonical import TuitionObservation
from tuitiontruth_pipeline.quality.diffing import detect_tuition_changes


class FakeStore:
    def __init__(self, current: dict[tuple[int, int, str], Decimal]) -> None:
        self._current = current

    def get_current_tuition(self, key: tuple[int, int, str]) -> Decimal | None:
        return self._current.get(key)


def _obs(amount: str) -> TuitionObservation:
    return TuitionObservation(
        ipeds_unit_id=1,
        academic_year=2024,
        residency_status="in_state",
        tuition_amount=Decimal(amount),
        source_type="scrape",
        source_url="https://src",
    )


def test_new_record_is_flagged_once() -> None:
    changes = detect_tuition_changes([_obs("10000")], FakeStore({}))
    assert len(changes) == 1
    assert changes[0].kind == "new"


def test_substantive_change_produces_exactly_one_pending_item() -> None:
    store = FakeStore({(1, 2024, "in_state"): Decimal("10000")})
    changes = detect_tuition_changes([_obs("11000")], store)
    assert len(changes) == 1
    assert changes[0].kind == "update"
    assert changes[0].old_value == Decimal("10000")
    assert changes[0].new_value == Decimal("11000")


def test_unchanged_value_produces_no_change() -> None:
    store = FakeStore({(1, 2024, "in_state"): Decimal("10000")})
    assert detect_tuition_changes([_obs("10000")], store) == []


def test_formatting_difference_is_not_a_change() -> None:
    store = FakeStore({(1, 2024, "in_state"): Decimal("10000.00")})
    assert detect_tuition_changes([_obs("10000")], store) == []


def test_change_below_absolute_tolerance_is_ignored() -> None:
    store = FakeStore({(1, 2024, "in_state"): Decimal("10000")})
    changes = detect_tuition_changes([_obs("10050")], store, min_absolute=Decimal("100"))
    assert changes == []
