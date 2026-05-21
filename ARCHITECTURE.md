# Ollive Inference Logger — Architecture

## 1. System Overview

```
                          +-------------------+
                          |   Next.js Frontend |
                          |   (Dashboard +    |
                          |    Chat UI)       |
                          +--------+----------+
                                   |
                                   | HTTP (REST)
                                   v
+----------+         +--------------------------+         +----------+
|  Ollive  |  POST   |      FastAPI Backend     |         |          |
|   SDK    | ------> |  /api/v1/ingest (202)    |         | Postgres |
| (Python) |         |  /api/v1/chat            |<------->|   16     |
+----------+         |  /dashboard/*            |         |          |
                      +--------+--------+-------+         +----+-----+
                               |        |                      ^
                               |        | SELECT/INSERT        |
                      XADD     |        +----------------------+
                               v
                      +------------------+
                      |  Redis Streams   |
                      |  inference:logs  |-----> inference:logs:dead
                      +--------+---------+       (dead-letter stream)
                               |
                      XREADGROUP (consumer group)
                               |
                      +--------v---------+
                      |     Worker(s)    |
                      |  - Validate      |
                      |  - PII Redact    |
                      |  - Enrich (cost) |
                      |  - Batch INSERT  |
                      |  - Update convs  |
                      |  - Refresh matview|
                      +------------------+
```

## 2. Ingestion Flow

The inference logging pipeline uses an event-driven architecture with Redis Streams
as the message broker. The flow is:

### Step 1: SDK Capture

The Ollive SDK (Python) runs inside the user's application. It captures inference
metrics using one of three patterns:

- **Context manager** (`client.track(...)`) — wraps a single LLM call with timing
- **Decorator** (`@track_inference(...)`) — wraps a function, auto-extracts usage
- **Auto-instrument** (`client.instrument_openai(openai)`) — monkey-patches the provider SDK

The SDK uses an `AsyncBatchTransport` that buffers logs in an `asyncio.Queue`
(bounded at 10,000 entries) and flushes them in batches to the ingest endpoint.
Flush triggers: every 2 seconds or when 50 logs accumulate, whichever comes first.
If the queue is full, new logs are silently dropped — the SDK never blocks the
host application.

### Step 2: Ingest Endpoint

`POST /api/v1/ingest` accepts a JSON array of inference logs. For each log, it:

1. Validates the payload against `InferenceLogCreate` (Pydantic)
2. Serializes it to a flat dict of strings
3. Publishes it to the `inference:logs` Redis Stream via `XADD`
4. Returns `202 Accepted` immediately — the response is not blocked on persistence

This decouples the write path from the database. The caller gets confirmation that
the events were accepted, not that they were stored.

### Step 3: Redis Streams

Events sit in the `inference:logs` stream. The stream is capped implicitly via
maxmemory policy (`allkeys-lru` with 256 MB limit). Consumer groups ensure
each message is processed exactly once across multiple worker replicas.

### Step 4: Worker Processing

Workers run in a consumer group (`ingestion-workers`). Each worker:

1. **Reads** a batch (up to 100 messages) from the stream via `XREADGROUP`
2. **Validates** each message with `InferenceLogData` (Pydantic)
3. **Redacts PII** — applies regex-based redaction on input/output previews
4. **Enriches** — estimates cost from token counts using the pricing table
5. **Batch inserts** into `inference_logs` using SQLAlchemy Core (not ORM)
6. **Updates conversation counters** atomically (`total_tokens`, `message_count`, `total_cost_usd`)
7. **ACKs** all processed messages

Failed messages are retried up to 3 times, then moved to the `inference:logs:dead`
dead-letter stream.

### Step 5: Materialized View

A background task in the worker refreshes `inference_stats_hourly` every 5 minutes.
This precomputes per-hour, per-provider, per-model aggregates (request count,
error count, latency percentiles, token totals, cost) to accelerate dashboard queries.

## 3. Logging Strategy

### Two-Stage PII Redaction

Ollive redacts PII at two points in the pipeline:

1. **SDK-side (Stage 1):** The `PIIRedactor` runs in-process before the data leaves
   the user's application. This is configurable (`off`, `standard`, `aggressive`).
   Standard mode catches emails, phone numbers (US/IN), SSNs, credit card numbers,
   IP addresses, and Aadhaar numbers using compiled regexes. Sub-millisecond overhead.

2. **Worker-side (Stage 2):** The `DeepRedactor` in the worker applies a second pass
   on `input_preview` and `output_preview` before database insertion. This catches
   anything the SDK missed (e.g., if the SDK was configured with `redact_pii=False`).

PII is replaced with `[REDACTED:{type}]` tokens, preserving the structure of the
text while removing sensitive data.

### Async Fire-and-Forget

All inference logging is non-blocking:

- The SDK enqueues to a bounded queue and returns immediately
- The ingest endpoint publishes to Redis and returns 202
- The chat service wraps the `redis.xadd()` call in a try/except that silently
  catches failures — a Redis outage never breaks the chat response

### Batch + Flush

The SDK transport batches logs (up to 50 per HTTP request) and flushes on a timer
(every 2 seconds). This reduces HTTP overhead and is configurable per-client.

## 4. Scaling Considerations

### Ingest Endpoint

The `/api/v1/ingest` endpoint is stateless — it validates and publishes to Redis.
Scale horizontally behind a load balancer. Each replica handles ~5K req/s with the
current setup. No sticky sessions required.

### Worker

Workers use Redis consumer groups, which means adding replicas automatically
distributes the load. Each worker reads a batch of 100 messages and processes
them in a single database transaction. Add replicas linearly as throughput grows.

### Redis Streams

Redis Streams are capped at the maxmemory limit. Consumer groups handle
backpressure naturally — if workers fall behind, messages accumulate in the
stream until workers catch up or the stream hits its memory limit.

Stale message reclaim runs every 30 seconds to handle worker crashes: any
message pending for >60 seconds is re-assigned to a healthy consumer.

### Database

- **Materialized view** (`inference_stats_hourly`) serves the dashboard's
  read-heavy aggregate queries. Refreshed every 5 minutes, so dashboard data
  is at most 5 minutes stale.
- **Partial index** (`ix_inference_logs_success_latency`) covers the common
  query pattern of "latency distribution for successful requests in a time range."
- **Batch inserts** via SQLAlchemy Core (not ORM) reduce round trips.

### When to Upgrade

| Signal                     | Current solution   | Upgrade to            |
|----------------------------|--------------------|-----------------------|
| >10K events/second ingest  | Redis Streams      | Apache Kafka          |
| >100M rows in inference_logs | PostgreSQL       | TimescaleDB           |
| Need sub-second dashboards | Materialized views | ClickHouse            |
| Multi-region deployment    | Single Redis       | Redis Cluster / Kafka |

## 5. Failure Handling

### SDK

- **Fire-and-forget:** The SDK never raises exceptions from logging operations.
  Errors are logged to Python's `logging` module.
- **Bounded queue:** The `asyncio.Queue` has a max size of 10,000. When full,
  new logs are silently dropped. This prevents unbounded memory growth.
- **Retry on transport failure:** The HTTP transport retries once (with 500ms
  backoff) on POST failure, then drops the batch.
- **Graceful shutdown:** `client.close()` drains the queue before stopping.

### Ingest Endpoint

- Returns `202 Accepted` immediately after publishing to Redis.
- Pydantic validation runs before Redis publish — malformed payloads are
  rejected with 422 before touching the stream.
- If Redis is down, the endpoint returns 500, and the SDK transport retries.

### Worker

- **Consumer groups** provide at-least-once delivery. If a worker crashes mid-batch,
  the messages remain in the pending entries list (PEL) and are reclaimed by another
  worker after 60 seconds.
- **Dead-letter stream:** After 3 failed processing attempts, a message is moved to
  `inference:logs:dead` and removed from the retry queue. Operators can inspect
  the dead-letter stream to diagnose persistent failures.
- **Graceful shutdown:** On SIGTERM/SIGINT, the consumer finishes the current batch
  before exiting.

### Database

- **Atomic counter updates:** Conversation counters (`total_tokens`, `message_count`,
  `total_cost_usd`) use SQL `SET col = col + :delta` to avoid read-modify-write
  races.
- **Transaction isolation:** Each batch of inserts + counter updates runs in a
  single database transaction. If any part fails, the entire batch rolls back.

### Frontend

- **AbortController:** Streaming chat responses use `AbortController` so the user
  can cancel in-flight requests without orphaned connections.
- **API error retry:** Dashboard API calls retry on transient errors before
  showing an error state.

## 6. Event-Based Architecture Rationale

The system uses Redis Streams as an event bus between the ingest endpoint and
the workers rather than writing directly to PostgreSQL from the API. This
design was chosen for several reasons:

1. **Decoupled write path:** The ingest endpoint returns in <1ms regardless of
   database load. Database writes happen asynchronously in the worker.

2. **Backpressure handling:** Redis Streams naturally buffer bursts. If 1000
   inference logs arrive in 1 second, they queue in Redis and the workers
   process them at their own pace.

3. **Horizontal scaling:** Adding worker replicas linearly increases throughput
   without changing the ingest endpoint or the database schema.

4. **Failure isolation:** A database outage does not affect the ingest endpoint
   or the chat API. Events queue in Redis until the database recovers.

5. **Processing pipeline:** The worker can run multiple stages (validate, redact,
   enrich, insert) without complicating the ingest endpoint. New stages can be
   added without touching the API.

6. **Replay capability:** Redis Streams retain messages even after processing,
   enabling replay for debugging or reprocessing with new enrichment logic.
