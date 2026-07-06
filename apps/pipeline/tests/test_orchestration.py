import pytest

from tuitiontruth_pipeline.orchestration.jobs import Job, Orchestrator


def test_runs_jobs_in_dependency_order() -> None:
    calls: list[str] = []
    orchestrator = Orchestrator()
    orchestrator.register(Job("source", lambda: calls.append("source")))
    orchestrator.register(Job("etl", lambda: calls.append("etl"), depends_on=("source",)))
    runs = orchestrator.run_all()
    assert calls == ["source", "etl"]
    assert all(run.status == "success" for run in runs)


def test_failure_skips_dependents_but_runs_unrelated_jobs() -> None:
    calls: list[str] = []

    def boom() -> None:
        raise RuntimeError("source down")

    orchestrator = Orchestrator()
    orchestrator.register(Job("source", boom))
    orchestrator.register(Job("etl", lambda: calls.append("etl"), depends_on=("source",)))
    orchestrator.register(Job("unrelated", lambda: calls.append("unrelated")))
    runs = {run.job_name: run.status for run in orchestrator.run_all()}
    assert runs["source"] == "failed"
    assert runs["etl"] == "skipped"
    assert runs["unrelated"] == "success"
    assert "etl" not in calls
    assert "unrelated" in calls


def test_manual_trigger_runs_single_job() -> None:
    calls: list[str] = []
    orchestrator = Orchestrator()
    orchestrator.register(Job("etl", lambda: calls.append("etl"), depends_on=("source",)))
    orchestrator.register(Job("source", lambda: calls.append("source")))
    run = orchestrator.run("etl")
    assert run.status == "success"
    assert calls == ["etl"]


def test_cycle_is_detected() -> None:
    orchestrator = Orchestrator()
    orchestrator.register(Job("a", lambda: None, depends_on=("b",)))
    orchestrator.register(Job("b", lambda: None, depends_on=("a",)))
    with pytest.raises(ValueError, match="cycle"):
        orchestrator.run_all()


def test_unknown_dependency_raises() -> None:
    orchestrator = Orchestrator()
    orchestrator.register(Job("etl", lambda: None, depends_on=("missing",)))
    with pytest.raises(ValueError, match="unknown job"):
        orchestrator.run_all()


def test_history_records_every_run() -> None:
    orchestrator = Orchestrator()
    orchestrator.register(Job("a", lambda: None))
    orchestrator.run_all()
    orchestrator.run("a")
    assert len(orchestrator.history) == 2
