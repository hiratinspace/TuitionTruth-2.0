"""Validated pipeline configuration.

Mirrors the TypeScript environment contract (`.env.example`) so the ingestion
service and the web app read the same variables. All fields carry defaults that
match the local docker-compose setup, so a bare `PipelineSettings()` works in
development; production supplies real values via the environment.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PipelineSettings(BaseSettings):
    """Runtime configuration loaded from the environment (and optional .env)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Storage
    database_url: str = Field(
        default="postgresql://tuitiontruth:tuitiontruth@localhost:5432/tuitiontruth",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")

    # College Scorecard (TUIT-10 / TUIT-12)
    college_scorecard_api_key: str = Field(default="", alias="COLLEGE_SCORECARD_API_KEY")
    scorecard_base_url: str = Field(
        default="https://api.data.gov/ed/collegescorecard/v1",
        alias="SCORECARD_BASE_URL",
    )
    scorecard_rate_limit_per_hour: int = Field(default=1000, alias="SCORECARD_RATE_LIMIT_PER_HOUR")
    scorecard_cache_ttl_seconds: int = Field(default=86_400, alias="SCORECARD_CACHE_TTL_SECONDS")

    # Scraper politeness (TUIT-13)
    scraper_user_agent: str = Field(
        default=(
            "TuitionTruthBot/1.0 (+https://tuitiontruth.example/bot; contact@tuitiontruth.example)"
        ),
        alias="SCRAPER_USER_AGENT",
    )
    scraper_per_domain_min_interval_seconds: float = Field(
        default=10.0, alias="SCRAPER_PER_DOMAIN_MIN_INTERVAL_SECONDS"
    )
    scraper_max_concurrency: int = Field(default=50, alias="SCRAPER_MAX_CONCURRENCY")

    # Alerting (TUIT-20)
    slack_webhook_url: str = Field(default="", alias="SLACK_WEBHOOK_URL")


@lru_cache(maxsize=1)
def get_settings() -> PipelineSettings:
    """Return a cached, validated settings instance."""
    return PipelineSettings()
