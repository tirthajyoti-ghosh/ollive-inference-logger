# Ollive Inference Logger

A lightweight, event-driven system for logging and analyzing LLM inference calls.
Ollive captures latency, token usage, cost, and errors across multiple providers
(OpenAI, Anthropic, Groq) and surfaces them through real-time dashboards. It
includes a multi-turn chatbot that dogfoods the logging pipeline, a Python SDK
for instrumenting external applications, and a streaming ingestion pipeline built
on Redis Streams.

## Architecture

```
+----------+      +-------------------+      +------------------+      +----------+
|  Ollive  | POST |   FastAPI Backend | XADD |  Redis Streams   | READ |  Worker  |
|   SDK    |----->|  /api/v1/ingest   |----->| inference:logs   |----->| Validate |
| (Python) | 202  |                   |      |                  |      | Redact   |
+----------+      |  /api/v1/chat     |      +------------------+      | Enrich   |
                  |  /dashboard/*     |                                | INSERT   |
                  +--------+----------+                                +----+-----+
                           |                                                |
                           |   SQL queries                                  |
                           v                                                v
                  +------------------+                              +-------+--------+
                  | Next.js Frontend |                              |   PostgreSQL   |
                  | (Chat + Dashboards)|                            | conversations  |
                  +------------------+                              | messages       |
                                                                    | inference_logs |
                                                                    | stats_hourly   |
                                                                    +----------------+
```

The ingestion pipeline decouples the write path: the ingest endpoint returns `202
Accepted` in <1ms and publishes to Redis Streams. Worker processes consume via
consumer groups, validate, redact PII, estimate costs, and batch-insert into
PostgreSQL. A materialized view (`inference_stats_hourly`) precomputes hourly
aggregates for dashboard performance.

## Quick Start

```bash
# Clone and configure
git clone https://github.com/your-org/ollive-inference-logger.git
cd ollive-inference-logger
cp .env.example .env
# Edit .env with your API keys (at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY)

# One-command setup (Docker Compose)
make up

# Open the app
open http://localhost:3000
```

## Features

- **Multi-turn chatbot** with support for OpenAI, Anthropic, and Groq providers
- **Lightweight Python SDK** for instrumenting any LLM application (decorator, context manager, auto-instrument)
- **Event-based ingestion pipeline** using Redis Streams with consumer groups
- **Real-time dashboards** — latency percentiles (p50/p95/p99), throughput (RPM), errors, cost tracking
- **Two-stage PII redaction** — regex-based, sub-millisecond, configurable (off/standard/aggressive)
- **Cost estimation** — automatic per-request cost calculation from token counts
- **Dead-letter handling** — failed messages retry 3x then move to a dead-letter stream
- **Docker Compose** one-command setup for local development
- **Kubernetes manifests** with Kustomize, HPA, and kind deployment script

## Schema Design

The database has three core tables and one materialized view:

### `conversations`

Represents a chat session. Stores the provider/model choice and denormalized
counters (`message_count`, `total_tokens`, `total_cost_usd`) that are atomically
incremented by the worker. Denormalization avoids expensive JOINs on the
dashboard — a conversation list page can render without touching `messages` or
`inference_logs` at all.

### `messages`

Individual chat messages (user/assistant/system) linked to a conversation. Indexed
on `(conversation_id, created_at)` for efficient context window retrieval. The
`token_count` column supports per-message cost attribution.

### `inference_logs`

The core analytics table. Every LLM API call produces one row with timing
(`latency_ms`, `time_to_first_token_ms`), token usage, cost, status, error
details, and redacted I/O previews. Designed for high write throughput via batch
inserts and wide read patterns via targeted indexes:

- `ix_inference_logs_created_at` — time-range scans for dashboards
- `ix_inference_logs_provider_model` — filter by provider/model
- `ix_inference_logs_success_latency` — partial index on successful requests for
  latency queries (smaller index, faster scans)
- `ix_inference_logs_session_id` — SDK session correlation

### `inference_stats_hourly` (Materialized View)

Precomputed hourly aggregates per provider/model: request count, error count,
avg/p50/p95/p99 latency, token totals, and cost. Refreshed every 5 minutes by
the worker. Dashboard queries hit this view instead of scanning millions of raw
log rows.

## SDK Usage

Install:

```bash
pip install ollive-sdk
```

### Pattern 1: Context Manager

```python
from ollive_sdk import OlliveClient

client = OlliveClient(endpoint="http://localhost:8000/api/v1/ingest")

with client.track(provider="openai", model="gpt-4o") as tracker:
    response = openai.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": "Hello"}]
    )
    tracker.set_usage(response.usage.prompt_tokens, response.usage.completion_tokens)
    tracker.set_output(response.choices[0].message.content)

client.close()
```

### Pattern 2: Decorator

```python
from ollive_sdk import OlliveClient, track_inference

client = OlliveClient(endpoint="http://localhost:8000/api/v1/ingest")

@track_inference(client, provider="openai", model="gpt-4o")
def ask(question: str):
    return openai.chat.completions.create(
        model="gpt-4o", messages=[{"role": "user", "content": question}]
    )

answer = ask("What is the meaning of life?")
```

### Pattern 3: Auto-Instrument

```python
import openai
from ollive_sdk import OlliveClient

client = OlliveClient(endpoint="http://localhost:8000/api/v1/ingest")
client.instrument_openai(openai)

# All openai.chat.completions.create() calls are now automatically logged.
response = openai.chat.completions.create(
    model="gpt-4o", messages=[{"role": "user", "content": "Hello"}]
)
```

## Tradeoffs

### 1. Redis Streams vs. Direct Database Writes

**Chose:** Redis Streams as an intermediate buffer.
**Why:** Decouples the ingest endpoint from database latency. The API returns 202 in <1ms regardless of database load. Enables horizontal scaling of workers independently.
**Tradeoff:** Adds operational complexity (Redis as a dependency) and introduces eventual consistency — a log may take a few seconds to appear in the dashboard.

### 2. PostgreSQL vs. ClickHouse/TimescaleDB

**Chose:** PostgreSQL with materialized views.
**Why:** Simpler operations, familiar tooling, sufficient for the expected scale (<100M rows). Materialized views give sub-second dashboard queries without a specialized OLAP engine.
**Tradeoff:** At very high volumes (>100M rows), aggregate queries on the raw table will slow down. The materialized view refresh interval (5 min) means dashboard data can be slightly stale.

### 3. Denormalized Counters on Conversations

**Chose:** Store `message_count`, `total_tokens`, `total_cost_usd` directly on the conversation row.
**Why:** The conversation list page and chat header need these numbers for every conversation. Computing them via JOIN/COUNT on every page load is expensive.
**Tradeoff:** Counter updates must be atomic (`SET col = col + :delta`) to avoid races. If the worker crashes between inserting a log and updating the counter, the counts diverge slightly.

### 4. Regex PII Redaction vs. ML-Based NER

**Chose:** Compiled regex patterns with labeled replacement tokens.
**Why:** Sub-millisecond, zero external dependencies, deterministic. Runs in the SDK (client-side) so PII never leaves the user's process.
**Tradeoff:** Misses unstructured PII like names, addresses, or context-dependent sensitive data. The aggressive mode helps but is still pattern-based.

### 5. Fire-and-Forget SDK vs. Guaranteed Delivery

**Chose:** Bounded queue with silent drops on overflow.
**Why:** The SDK must never impact the host application's latency or reliability. A full queue is better than unbounded memory growth or blocking the caller.
**Tradeoff:** Under extreme load, some inference logs may be silently dropped. The transport retries once on HTTP failure but does not persist to disk.

### 6. Materialized View vs. Real-Time Aggregation

**Chose:** Periodic refresh (every 5 min) of a materialized view.
**Why:** Dashboard queries are read-heavy and aggregate large time ranges. Precomputing avoids expensive `percentile_cont` scans on every page load.
**Tradeoff:** Dashboard data is up to 5 minutes stale. The `REFRESH MATERIALIZED VIEW CONCURRENTLY` command takes a brief lock but does not block reads.

### 7. Streaming via SSE vs. WebSocket

**Chose:** Server-Sent Events (SSE) for streaming chat responses.
**Why:** SSE is simpler, works through HTTP proxies/CDNs, and is sufficient for server-to-client streaming. The chat use case is unidirectional (server pushes tokens to client).
**Tradeoff:** No bidirectional communication. If the dashboard needed real-time push updates, WebSocket would be required.

### 8. Monorepo with Docker Compose vs. Separate Repos

**Chose:** Monorepo with backend/, worker/, frontend/, sdk/ directories.
**Why:** Simplifies development setup (`make up` starts everything), keeps shared schemas in sync, and makes it easy to reason about the full system during code review.
**Tradeoff:** Larger repository, all services share the same CI pipeline, and independent deployment of a single service requires more care.

## What I Would Improve With More Time

- **ClickHouse/TimescaleDB** for analytics at scale — move the time-series data to a columnar store for sub-second aggregation over billions of rows
- **OpenTelemetry (OTel) integration** for industry-standard distributed tracing, replacing the custom SDK instrumentation
- **Prompt versioning and A/B test tracking** — tag each inference log with a prompt version ID to measure the impact of prompt changes
- **Real-time WebSocket dashboard updates** — push new data to the dashboard via WebSocket instead of polling
- **SDK for TypeScript/JavaScript** — a companion SDK for Node.js/browser applications
- **Grafana integration** — expose Prometheus metrics from the backend and worker for operational monitoring
- **Rate limiting on ingest endpoint** — protect against SDK misconfigurations or abuse
- **Authentication and multi-tenancy** — API keys, team isolation, RBAC on the dashboard
- **CI/CD pipeline with GitHub Actions** — automated testing, image builds, and deployment on push
- **Comprehensive integration test suite** — end-to-end tests covering the full ingest-to-dashboard pipeline

## Tech Stack

| Component     | Technology           | Why                                                                 |
|---------------|----------------------|---------------------------------------------------------------------|
| Backend API   | FastAPI (Python)     | Async-native, Pydantic validation, OpenAPI docs, high performance   |
| Frontend      | Next.js (TypeScript) | React framework with SSR, App Router, strong ecosystem              |
| Database      | PostgreSQL 16        | Reliable, JSONB support, materialized views, partial indexes        |
| Message Broker| Redis 7 Streams      | Low-latency pub/sub with consumer groups, built-in backpressure     |
| Worker        | Python (asyncio)     | Shares models/schemas with backend, native async DB and Redis       |
| SDK           | Python (aiohttp)     | Async batch transport, zero required dependencies on user's app     |
| ORM           | SQLAlchemy 2.0       | Async support, type-safe mapped columns, Core for batch inserts     |
| Migrations    | Alembic              | Version-controlled schema changes, paired with SQLAlchemy           |
| Containers    | Docker Compose       | One-command local dev, multi-service orchestration                  |
| Orchestration | Kubernetes           | Production-grade deployment with HPA, health probes, ingress        |

## Project Structure

```
ollive-inference-logger/
├── backend/                 # FastAPI API server
│   ├── src/
│   │   ├── api/             # Route handlers (chat, ingest, dashboard, conversations)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (chat, dashboard, LLM providers)
│   │   ├── config.py        # Settings via pydantic-settings
│   │   ├── database.py      # Engine, session factory, Base
│   │   └── main.py          # FastAPI app, middleware, health checks
│   ├── alembic/             # Database migrations
│   ├── scripts/             # Seed script
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── worker/                  # Redis Streams consumer
│   ├── src/worker/
│   │   ├── consumer.py      # Stream reader with consumer groups
│   │   ├── processor.py     # Validate, redact, enrich, insert pipeline
│   │   ├── redactor.py      # Worker-side PII redaction (stage 2)
│   │   ├── matview.py       # Materialized view refresher
│   │   ├── health.py        # Health check HTTP server
│   │   └── main.py          # Entry point
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                # Next.js dashboard + chat UI
│   ├── src/app/
│   ├── Dockerfile
│   └── package.json
├── sdk/                     # Ollive Python SDK
│   ├── src/ollive_sdk/
│   │   ├── client.py        # OlliveClient (track, atrack, instrument_*)
│   │   ├── transport.py     # Async batch HTTP transport
│   │   ├── decorator.py     # @track_inference
│   │   ├── context.py       # AsyncInferenceTracker
│   │   ├── redactor.py      # PII redaction (stage 1)
│   │   ├── providers/       # Auto-instrument wrappers (OpenAI, Anthropic)
│   │   └── types.py         # InferenceLog, TokenUsage dataclasses
│   └── tests/
├── k8s/                     # Kubernetes manifests (Kustomize)
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── kustomization.yaml
│   ├── ingress.yaml
│   ├── postgres/            # StatefulSet + Service
│   ├── redis/               # Deployment + Service
│   ├── backend/             # Deployment + Service + HPA
│   ├── worker/              # Deployment + HPA
│   └── frontend/            # Deployment + Service
├── scripts/
│   ├── deploy-kind.sh       # One-command kind cluster deployment
│   └── migrate.sh           # Migration helper
├── docker-compose.yml
├── Makefile
├── .env.example
├── ARCHITECTURE.md          # Detailed architecture documentation
└── README.md
```

## Kubernetes Deployment

For production-like deployment using [kind](https://kind.sigs.k8s.io/) (Kubernetes in Docker):

```bash
# Prerequisites: kind, kubectl, docker
brew install kind kubectl

# Deploy everything
./scripts/deploy-kind.sh

# Add to /etc/hosts
echo "127.0.0.1 ollive.local" | sudo tee -a /etc/hosts

# Visit
open http://ollive.local
```

The Kubernetes manifests include:

- **PostgreSQL StatefulSet** with persistent volume claims (10Gi)
- **Redis Deployment** with AOF persistence and memory limits
- **Backend Deployment** (2 replicas) with rolling updates, startup/liveness/readiness probes, and init container for migrations
- **Worker Deployment** (2 replicas) for stream consumption
- **Frontend Deployment** (2 replicas)
- **HorizontalPodAutoscaler** for backend (2-5 replicas) and worker (2-4 replicas) at 70% CPU target
- **Nginx Ingress** routing `/api` and `/health` to backend, `/` to frontend
- **Kustomize** for namespace-scoped resource management

To tear down:

```bash
kind delete cluster --name ollive
```

## Render Deployment

The repo includes a `render.yaml` blueprint for one-click deploy on [Render](https://render.com):

### One-click deploy

1. Push the repo to GitHub
2. Go to [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
3. Click **New Blueprint Instance** → connect your repo
4. Render creates all 5 services automatically: PostgreSQL, Redis, Backend, Worker, Frontend

### Post-deploy setup

After the first deploy completes:

1. **Set API keys** — go to the `ollive-backend` service → Environment, fill in `GROQ_API_KEY` and/or `GEMINI_API_KEY`
2. **Wire frontend → backend** — go to the `ollive-frontend` service → Environment, set `NEXT_PUBLIC_API_URL` to the backend's URL (e.g., `https://ollive-backend.onrender.com`)
3. Redeploy both services to pick up the new env vars

### Architecture on Render

```
Internet → ollive-frontend (public)
              ↓ /api/* rewrite
           ollive-backend (public) ← ollive-worker (background)
              ↓                         ↓
           ollive-db                ollive-redis
           (managed PG)            (managed Redis)
```
