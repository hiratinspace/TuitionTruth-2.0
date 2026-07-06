"""Job orchestration (TUIT-19).

A dependency-aware job runner: jobs declare `depends_on` and a `cadence`; the
ETL job only runs after its sources succeed. Failure domains are isolated — a
failed job skips only its (transitive) dependents, while unrelated branches run
to completion. Run history is retained and any job can be triggered manually.

This is a lightweight, dependency-free runner suitable for a cron host; it maps
directly onto Dagster assets if/when that is adopted (see docs/BUILD_PLAN.md).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from tuitiontruth_pipeline.logging_config import get_logger

logger = get_logger("orchestration.jobs")

JobStatus = Literal["success", "failed", "skipped"]


@dataclass(frozen=True)
class Job:
    name: str
    run: Callable[[], None]
    depends_on: tuple[str, ...] = ()
    cadence: str = "@daily"


@dataclass
class JobRun:
    job_name: str
    status: JobStatus
    started_at: datetime
    finished_at: datetime
    error: str | None = None


class Orchestrator:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self.history: list[JobRun] = []

    def register(self, job: Job) -> None:
        if job.name in self._jobs:
            raise ValueError(f"duplicate job: {job.name}")
        self._jobs[job.name] = job

    def _topological_order(self) -> list[str]:
        """Kahn's algorithm; raises on unknown dependency or cycle."""
        indegree: dict[str, int] = {name: 0 for name in self._jobs}
        dependents: dict[str, list[str]] = {name: [] for name in self._jobs}
        for job in self._jobs.values():
            for dep in job.depends_on:
                if dep not in self._jobs:
                    raise ValueError(f"job {job.name} depends on unknown job {dep}")
                indegree[job.name] += 1
                dependents[dep].append(job.name)

        ready = sorted(name for name, deg in indegree.items() if deg == 0)
        order: list[str] = []
        while ready:
            name = ready.pop(0)
            order.append(name)
            for dependent in dependents[name]:
                indegree[dependent] -= 1
                if indegree[dependent] == 0:
                    ready.append(dependent)
            ready.sort()
        if len(order) != len(self._jobs):
            raise ValueError("job dependency cycle detected")
        return order

    def _execute(self, job: Job) -> JobRun:
        started = datetime.now(UTC)
        try:
            job.run()
            run = JobRun(job.name, "success", started, datetime.now(UTC))
            logger.info("job_success", extra={"job": job.name})
        except Exception as exc:
            run = JobRun(job.name, "failed", started, datetime.now(UTC), error=str(exc))
            logger.error("job_failed", extra={"job": job.name, "error": str(exc)})
        self.history.append(run)
        return run

    def run(self, name: str) -> JobRun:
        """Manually trigger a single job, ignoring dependencies (TUIT-19 AC #3)."""
        if name not in self._jobs:
            raise KeyError(f"unknown job: {name}")
        return self._execute(self._jobs[name])

    def run_all(self) -> list[JobRun]:
        """Run every job in dependency order. A job whose dependency failed or
        was skipped is itself skipped; unrelated jobs still run."""
        order = self._topological_order()
        blocked: set[str] = set()
        runs: list[JobRun] = []
        for name in order:
            job = self._jobs[name]
            if any(dep in blocked for dep in job.depends_on):
                now = datetime.now(UTC)
                run = JobRun(name, "skipped", now, now, error="upstream dependency did not succeed")
                self.history.append(run)
                runs.append(run)
                blocked.add(name)
                logger.warning("job_skipped", extra={"job": name})
                continue
            run = self._execute(job)
            runs.append(run)
            if run.status != "success":
                blocked.add(name)
        return runs
