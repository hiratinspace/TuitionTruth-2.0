# TuitionTruth Pipeline

Python 3.12 data-ingestion service. Reads from the College Scorecard API, IPEDS bulk files, and per-institution scrapers; normalizes everything into the canonical schema owned by `packages/db`; and routes flagged changes to human QA. See `docs/BUILD_PLAN.md` §2.

Data flows one direction — this service **writes** the canonical tables (through the diff → QA gate); it never serves user traffic.

## Layout (built out across Phase 2)

```
src/tuitiontruth_pipeline/
├── settings.py       # validated configuration (mirrors the TS env contract)
├── sources/          # scorecard.py, ipeds.py — one module per data source
├── scrapers/
│   ├── framework/    # generic fetch + extract engine (TUIT-13)
│   └── configs/      # per-institution YAML configs (TUIT-14)
├── etl/              # canonical normalization (TUIT-16)
├── quality/          # change-detection diffing + anomaly detection (TUIT-17/26)
└── dags/             # Dagster asset definitions (TUIT-19)
```

## Development

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

ruff check .          # lint
ruff format .         # format
mypy src              # strict type check
pytest                # tests
```
