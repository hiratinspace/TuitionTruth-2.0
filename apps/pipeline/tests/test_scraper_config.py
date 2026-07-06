from pathlib import Path

import pytest
from pydantic import ValidationError

from tuitiontruth_pipeline.scrapers.config import (
    FieldSelector,
    ScraperConfig,
    load_configs,
    validate_config,
)

CONFIG_DIR = Path(__file__).resolve().parents[1] / "src/tuitiontruth_pipeline/scrapers/configs"


def test_config_requires_at_least_one_selector() -> None:
    with pytest.raises(ValidationError):
        ScraperConfig(
            ipeds_unit_id=1,
            name="Empty",
            url="https://x.edu",
            academic_year=2025,
        )


def test_shipped_sample_configs_load_and_validate() -> None:
    configs = load_configs(CONFIG_DIR)
    assert len(configs) >= 3
    for config in configs:
        assert config.ipeds_unit_id > 0
        # Sample configs are clean — no activation warnings.
        assert validate_config(config) == []


def test_validate_flags_missing_tuition_and_non_https() -> None:
    config = ScraperConfig(
        ipeds_unit_id=2,
        name="Fees Only",
        url="http://insecure.edu",
        academic_year=2025,
        mandatory_fee=FieldSelector(expr=".fee"),
    )
    warnings = validate_config(config)
    assert any("no tuition selector" in w for w in warnings)
    assert any("not https" in w for w in warnings)
