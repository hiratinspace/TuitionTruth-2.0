"""Per-institution scraper configuration (TUIT-14).

New institutions are onboarded by adding a version-controlled YAML config — no
code changes — because bursar pages have zero standardization across ~6,000
schools. `validate_config` flags configs missing required field mappings before
they are activated (AC #3).
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, model_validator

SelectorType = Literal["css", "xpath"]


class FieldSelector(BaseModel):
    """How to locate and extract one field from the page."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    type: SelectorType = "css"
    expr: str
    # If set, read this attribute; otherwise use the element's text content.
    attribute: str | None = None
    # Optional regex; the first capturing group (or whole match) isolates the number.
    regex: str | None = None


class ScraperConfig(BaseModel):
    """A single institution's scrape definition."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    ipeds_unit_id: int
    name: str
    url: str
    academic_year: int
    # Robots override is opt-in and, per policy, requires manual approval.
    respect_robots: bool = True
    tuition_in_state: FieldSelector | None = None
    tuition_out_of_state: FieldSelector | None = None
    mandatory_fee: FieldSelector | None = None

    @model_validator(mode="after")
    def _require_at_least_one_field(self) -> ScraperConfig:
        if (
            self.tuition_in_state is None
            and self.tuition_out_of_state is None
            and self.mandatory_fee is None
        ):
            raise ValueError("config must define at least one field selector")
        return self


def load_config(path: Path) -> ScraperConfig:
    """Load and validate a single YAML config."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return ScraperConfig.model_validate(data)


def load_configs(directory: Path) -> list[ScraperConfig]:
    """Load every `*.yaml` config in a directory, sorted by filename."""
    return [load_config(p) for p in sorted(directory.glob("*.yaml"))]


def validate_config(config: ScraperConfig) -> list[str]:
    """Return human-readable warnings for a config that parses but is weak
    (e.g. no tuition selector at all). Empty list means good to activate."""
    warnings: list[str] = []
    if config.tuition_in_state is None and config.tuition_out_of_state is None:
        warnings.append(f"{config.name}: no tuition selector — only fees will be scraped")
    if not config.url.startswith("https://"):
        warnings.append(f"{config.name}: url is not https")
    return warnings
