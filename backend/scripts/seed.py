"""Seed demo data for Ollive Inference Logger.

Creates realistic conversations, messages, and inference logs that make
the dashboards look populated and impressive for demos.

Run with:
    python -m scripts.seed          # from within the backend container
    docker compose exec backend python -m scripts.seed
    make seed
"""

from __future__ import annotations

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://ollive:ollive_dev@localhost:5432/ollive",
)

# Parse asyncpg-compatible DSN from SQLAlchemy URL
DSN = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

PROVIDERS_AND_MODELS = [
    ("openai", "gpt-4o"),
    ("openai", "gpt-4o-mini"),
    ("anthropic", "claude-sonnet-4-20250514"),
    ("anthropic", "claude-haiku-4-20250414"),
    ("groq", "llama-3.1-70b-versatile"),
]

# Latency and token profiles per model (min_latency, max_latency, min_tokens, max_tokens)
MODEL_PROFILES: dict[str, dict] = {
    "gpt-4o": {
        "latency_range": (500, 3000),
        "prompt_tokens_range": (200, 1500),
        "completion_tokens_range": (50, 2000),
        "input_cost_per_token": 2.50 / 1_000_000,
        "output_cost_per_token": 10.00 / 1_000_000,
    },
    "gpt-4o-mini": {
        "latency_range": (200, 1200),
        "prompt_tokens_range": (100, 800),
        "completion_tokens_range": (30, 600),
        "input_cost_per_token": 0.15 / 1_000_000,
        "output_cost_per_token": 0.60 / 1_000_000,
    },
    "claude-sonnet-4-20250514": {
        "latency_range": (400, 2500),
        "prompt_tokens_range": (200, 1200),
        "completion_tokens_range": (50, 1500),
        "input_cost_per_token": 3.00 / 1_000_000,
        "output_cost_per_token": 15.00 / 1_000_000,
    },
    "claude-haiku-4-20250414": {
        "latency_range": (150, 800),
        "prompt_tokens_range": (100, 600),
        "completion_tokens_range": (30, 500),
        "input_cost_per_token": 0.80 / 1_000_000,
        "output_cost_per_token": 4.00 / 1_000_000,
    },
    "llama-3.1-70b-versatile": {
        "latency_range": (100, 600),
        "prompt_tokens_range": (100, 1000),
        "completion_tokens_range": (30, 800),
        "input_cost_per_token": 0.59 / 1_000_000,
        "output_cost_per_token": 0.79 / 1_000_000,
    },
}

CONVERSATION_TITLES = [
    "Help me write a Python script",
    "Explain quantum computing basics",
    "Draft a marketing email",
    "Debug my React component",
    "Write SQL query for analytics",
    "Summarize this research paper",
    "Plan a weekend trip to Tokyo",
    "Build a REST API design",
    "Explain machine learning concepts",
    "Refactor my database schema",
    "Create a meal planning app",
    "Write unit tests for auth module",
    "Design a microservices architecture",
    "Translate document to Spanish",
    "Optimize my Kubernetes deployment",
]

CONVERSATION_STATUSES = ["active", "completed", "completed", "completed", "active"]

USER_MESSAGES = [
    "Can you help me with this?",
    "How does this work exactly?",
    "Can you explain that in simpler terms?",
    "What would be the best approach here?",
    "Could you write some example code?",
    "What are the tradeoffs of this approach?",
    "Can you optimize this further?",
    "What about error handling?",
    "How would you test this?",
    "Thanks, can you also add documentation?",
    "What if we need to scale this?",
    "Is there a more efficient way?",
    "Can you walk me through this step by step?",
    "What are the security implications?",
    "How does this compare to the alternative?",
]

ASSISTANT_MESSAGES = [
    "I'd be happy to help! Here's my approach...",
    "Great question. Let me break this down for you.",
    "Sure, here's a simplified explanation...",
    "I'd recommend the following approach for several reasons...",
    "Here's an example implementation with comments...",
    "There are several tradeoffs to consider here...",
    "I've optimized the code in the following ways...",
    "Good point about error handling. Here's a robust approach...",
    "Here's a comprehensive test strategy...",
    "I've added inline documentation and a README section...",
    "For scaling, I'd suggest the following architecture...",
    "Yes, there's a more efficient approach using...",
    "Let me walk you through each step...",
    "From a security perspective, you should consider...",
    "Compared to the alternative, this approach offers...",
]

INPUT_PREVIEWS = [
    "Help me write a Python function that calculates the Fibonacci sequence efficiently",
    "What is the difference between TCP and UDP protocols?",
    "Can you review this code and suggest improvements? def calc(x): return x*2+1",
    "Explain how transformers work in machine learning, specifically self-attention",
    "Write a SQL query to find the top 10 customers by revenue in the last quarter",
    "Draft a professional email declining a meeting invitation politely",
    "How do I set up a CI/CD pipeline with GitHub Actions for a Python project?",
    "What are the SOLID principles and how do they apply to Python?",
    "Help me debug this error: TypeError: Cannot read property of undefined",
    "Design a database schema for a multi-tenant SaaS application",
]

OUTPUT_PREVIEWS = [
    "Here's an efficient Fibonacci implementation using memoization: ```python def fib(n, memo={}): ...",
    "TCP is a connection-oriented protocol that guarantees delivery, while UDP is connectionless...",
    "I see a few improvements: 1) Add type hints, 2) Use a more descriptive name, 3) Add docstring...",
    "Transformers use self-attention to weigh the importance of different parts of the input...",
    "```sql SELECT c.name, SUM(o.amount) as total_revenue FROM customers c JOIN orders o ON...",
    "Subject: Re: Meeting Request\n\nThank you for the invitation. Unfortunately, I have a...",
    "Here's a complete GitHub Actions workflow for Python:\n```yaml\nname: CI\non: [push, pull...",
    "The SOLID principles are: Single Responsibility, Open/Closed, Liskov Substitution...",
    "The TypeError occurs because you're trying to access a property on an undefined value...",
    "Here's a schema design using row-level security:\n```sql\nCREATE TABLE tenants (id UUID...",
]

ERROR_TYPES = [
    ("RateLimitError", "Rate limit exceeded. Please retry after 60 seconds.", 429),
    ("APIConnectionError", "Connection to API timed out after 30s", None),
    ("InvalidRequestError", "Maximum context length exceeded: 128000 tokens", 400),
    ("AuthenticationError", "Invalid API key provided", 401),
    ("ServiceUnavailableError", "The server is temporarily overloaded", 503),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def random_timestamp_last_24h() -> datetime:
    """Return a random timestamp within the last 24 hours."""
    now = datetime.now(timezone.utc)
    offset = random.uniform(0, 24 * 3600)
    return now - timedelta(seconds=offset)


def spread_timestamps(count: int) -> list[datetime]:
    """Generate `count` timestamps spread across the last 24 hours for visual appeal."""
    now = datetime.now(timezone.utc)
    timestamps = []
    for i in range(count):
        # Spread evenly with some jitter
        base_offset = (24 * 3600 / count) * i
        jitter = random.uniform(-300, 300)  # +/- 5 minutes
        offset = max(0, base_offset + jitter)
        timestamps.append(now - timedelta(seconds=offset))
    return sorted(timestamps)


# ---------------------------------------------------------------------------
# Core seeding logic
# ---------------------------------------------------------------------------

async def seed() -> None:
    """Insert demo conversations, messages, and inference logs."""
    conn = await asyncpg.connect(DSN)
    try:
        print("Connected to database. Seeding demo data...")

        # Clear existing seed data (but keep any real data)
        await conn.execute("DELETE FROM inference_logs")
        await conn.execute("DELETE FROM messages")
        await conn.execute("DELETE FROM conversations")
        print("Cleared existing data.")

        # -----------------------------------------------------------
        # 1. Create conversations
        # -----------------------------------------------------------
        num_conversations = random.randint(12, 15)
        conversations: list[dict] = []

        for i in range(num_conversations):
            provider, model = random.choice(PROVIDERS_AND_MODELS)
            title = CONVERSATION_TITLES[i % len(CONVERSATION_TITLES)]
            status = random.choice(CONVERSATION_STATUSES)
            created_at = random_timestamp_last_24h()
            conv_id = uuid.uuid4()

            await conn.execute(
                """
                INSERT INTO conversations (id, title, provider, model, status, message_count,
                                           total_tokens, total_cost_usd, metadata, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, 0, 0, 0, '{}', $6, $6)
                """,
                conv_id, title, provider, model, status, created_at,
            )

            conversations.append({
                "id": conv_id,
                "provider": provider,
                "model": model,
                "created_at": created_at,
            })

        print(f"Created {num_conversations} conversations.")

        # -----------------------------------------------------------
        # 2. Create messages for each conversation
        # -----------------------------------------------------------
        total_messages = 0
        conversation_messages: dict[uuid.UUID, list[uuid.UUID]] = {}

        for conv in conversations:
            num_turns = random.randint(2, 8)
            msg_time = conv["created_at"]
            msg_ids: list[uuid.UUID] = []

            for turn in range(num_turns):
                # User message
                user_msg_id = uuid.uuid4()
                user_content = random.choice(USER_MESSAGES)
                msg_time = msg_time + timedelta(seconds=random.randint(5, 120))

                await conn.execute(
                    """
                    INSERT INTO messages (id, conversation_id, role, content, token_count, created_at)
                    VALUES ($1, $2, 'user', $3, $4, $5)
                    """,
                    user_msg_id,
                    conv["id"],
                    user_content,
                    random.randint(10, 200),
                    msg_time,
                )
                msg_ids.append(user_msg_id)
                total_messages += 1

                # Assistant message
                assistant_msg_id = uuid.uuid4()
                assistant_content = random.choice(ASSISTANT_MESSAGES)
                msg_time = msg_time + timedelta(seconds=random.randint(1, 10))

                await conn.execute(
                    """
                    INSERT INTO messages (id, conversation_id, role, content, token_count, created_at)
                    VALUES ($1, $2, 'assistant', $3, $4, $5)
                    """,
                    assistant_msg_id,
                    conv["id"],
                    assistant_content,
                    random.randint(50, 500),
                    msg_time,
                )
                msg_ids.append(assistant_msg_id)
                total_messages += 1

            conversation_messages[conv["id"]] = msg_ids

        print(f"Created {total_messages} messages across {num_conversations} conversations.")

        # -----------------------------------------------------------
        # 3. Create inference logs
        # -----------------------------------------------------------
        total_logs = 0
        conversation_counters: dict[uuid.UUID, dict] = {
            c["id"]: {"message_count": 0, "total_tokens": 0, "total_cost_usd": 0.0}
            for c in conversations
        }

        # Logs tied to conversations (from chat interactions)
        for conv in conversations:
            msg_ids = conversation_messages[conv["id"]]
            model = conv["model"]
            profile = MODEL_PROFILES[model]
            num_logs = len(msg_ids) // 2  # One log per assistant response

            for j in range(num_logs):
                log_id = uuid.uuid4()
                # Pick assistant message (every other one starting at index 1)
                msg_idx = j * 2 + 1
                msg_id = msg_ids[msg_idx] if msg_idx < len(msg_ids) else None

                # Determine status
                roll = random.random()
                if roll < 0.05:  # 5% error rate
                    status = "error"
                    err = random.choice(ERROR_TYPES)
                    error_type, error_message, http_status = err
                    latency_ms = random.randint(100, 30000)
                    prompt_tokens = None
                    completion_tokens = None
                    total_tokens = None
                    cost = None
                    is_streaming = False
                    ttft = None
                    stream_chunks = None
                    stream_duration = None
                elif roll < 0.07:  # 2% rate limited
                    status = "rate_limited"
                    error_type = "RateLimitError"
                    error_message = "Rate limit exceeded"
                    http_status = 429
                    latency_ms = random.randint(50, 500)
                    prompt_tokens = None
                    completion_tokens = None
                    total_tokens = None
                    cost = None
                    is_streaming = False
                    ttft = None
                    stream_chunks = None
                    stream_duration = None
                else:
                    status = "success"
                    error_type = None
                    error_message = None
                    http_status = None

                    latency_ms = random.randint(*profile["latency_range"])
                    prompt_tokens = random.randint(*profile["prompt_tokens_range"])
                    completion_tokens = random.randint(*profile["completion_tokens_range"])
                    total_tokens = prompt_tokens + completion_tokens

                    cost = round(
                        prompt_tokens * profile["input_cost_per_token"]
                        + completion_tokens * profile["output_cost_per_token"],
                        6,
                    )

                    # 30% chance of streaming
                    is_streaming = random.random() < 0.30
                    if is_streaming:
                        ttft = random.randint(20, max(50, int(latency_ms * 0.3)))
                        stream_chunks = random.randint(10, 150)
                        stream_duration = latency_ms
                    else:
                        ttft = None
                        stream_chunks = None
                        stream_duration = None

                request_ts = conv["created_at"] + timedelta(
                    seconds=random.randint(j * 60, (j + 1) * 120)
                )
                response_ts = request_ts + timedelta(milliseconds=latency_ms)

                input_preview = random.choice(INPUT_PREVIEWS) if random.random() < 0.8 else None
                output_preview = random.choice(OUTPUT_PREVIEWS) if status == "success" and random.random() < 0.8 else None

                await conn.execute(
                    """
                    INSERT INTO inference_logs (
                        id, conversation_id, message_id, session_id,
                        provider, model, request_timestamp, response_timestamp,
                        latency_ms, time_to_first_token_ms,
                        prompt_tokens, completion_tokens, total_tokens,
                        estimated_cost_usd, status, error_type, error_message,
                        http_status_code, input_preview, output_preview,
                        is_streaming, stream_chunk_count, stream_duration_ms,
                        metadata, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                        $21, $22, $23, $24, $25
                    )
                    """,
                    log_id, conv["id"], msg_id, f"session-{conv['id'].hex[:8]}",
                    conv["provider"], model, request_ts, response_ts,
                    latency_ms, ttft,
                    prompt_tokens, completion_tokens, total_tokens,
                    cost, status, error_type, error_message,
                    http_status, input_preview, output_preview,
                    is_streaming, stream_chunks, stream_duration,
                    "{}", request_ts,
                )
                total_logs += 1

                # Track counters for denormalization
                if status == "success":
                    conversation_counters[conv["id"]]["message_count"] += 1
                    conversation_counters[conv["id"]]["total_tokens"] += total_tokens or 0
                    conversation_counters[conv["id"]]["total_cost_usd"] += cost or 0.0

        # Standalone inference logs (SDK-only, no conversation)
        standalone_timestamps = spread_timestamps(60)
        for ts in standalone_timestamps:
            provider, model = random.choice(PROVIDERS_AND_MODELS)
            profile = MODEL_PROFILES[model]
            log_id = uuid.uuid4()

            roll = random.random()
            if roll < 0.05:
                status = "error"
                err = random.choice(ERROR_TYPES)
                error_type, error_message, http_status = err
                latency_ms = random.randint(100, 30000)
                prompt_tokens = None
                completion_tokens = None
                total_tokens = None
                cost = None
                is_streaming = False
                ttft = None
                stream_chunks = None
                stream_duration = None
            elif roll < 0.07:
                status = "rate_limited"
                error_type = "RateLimitError"
                error_message = "Rate limit exceeded"
                http_status = 429
                latency_ms = random.randint(50, 500)
                prompt_tokens = None
                completion_tokens = None
                total_tokens = None
                cost = None
                is_streaming = False
                ttft = None
                stream_chunks = None
                stream_duration = None
            else:
                status = "success"
                error_type = None
                error_message = None
                http_status = None
                latency_ms = random.randint(*profile["latency_range"])
                prompt_tokens = random.randint(*profile["prompt_tokens_range"])
                completion_tokens = random.randint(*profile["completion_tokens_range"])
                total_tokens = prompt_tokens + completion_tokens
                cost = round(
                    prompt_tokens * profile["input_cost_per_token"]
                    + completion_tokens * profile["output_cost_per_token"],
                    6,
                )
                is_streaming = random.random() < 0.25
                if is_streaming:
                    ttft = random.randint(20, max(50, int(latency_ms * 0.3)))
                    stream_chunks = random.randint(10, 150)
                    stream_duration = latency_ms
                else:
                    ttft = None
                    stream_chunks = None
                    stream_duration = None

            request_ts = ts
            response_ts = request_ts + timedelta(milliseconds=latency_ms)
            session_id = f"sdk-session-{random.randint(1, 10):03d}"

            input_preview = random.choice(INPUT_PREVIEWS) if random.random() < 0.7 else None
            output_preview = random.choice(OUTPUT_PREVIEWS) if status == "success" and random.random() < 0.7 else None

            await conn.execute(
                """
                INSERT INTO inference_logs (
                    id, conversation_id, message_id, session_id,
                    provider, model, request_timestamp, response_timestamp,
                    latency_ms, time_to_first_token_ms,
                    prompt_tokens, completion_tokens, total_tokens,
                    estimated_cost_usd, status, error_type, error_message,
                    http_status_code, input_preview, output_preview,
                    is_streaming, stream_chunk_count, stream_duration_ms,
                    metadata, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    $21, $22, $23, $24, $25
                )
                """,
                log_id, None, None, session_id,
                provider, model, request_ts, response_ts,
                latency_ms, ttft,
                prompt_tokens, completion_tokens, total_tokens,
                cost, status, error_type, error_message,
                http_status, input_preview, output_preview,
                is_streaming, stream_chunks, stream_duration,
                "{}", request_ts,
            )
            total_logs += 1

        print(f"Created {total_logs} inference logs.")

        # -----------------------------------------------------------
        # 4. Update conversation denormalized counters
        # -----------------------------------------------------------
        for conv_id, counters in conversation_counters.items():
            actual_msg_count = len(conversation_messages.get(conv_id, []))
            await conn.execute(
                """
                UPDATE conversations
                SET message_count = $1,
                    total_tokens = $2,
                    total_cost_usd = $3,
                    updated_at = now()
                WHERE id = $4
                """,
                actual_msg_count,
                counters["total_tokens"],
                round(counters["total_cost_usd"], 6),
                conv_id,
            )

        print(f"Updated denormalized counters for {len(conversation_counters)} conversations.")

        # -----------------------------------------------------------
        # 5. Refresh the materialized view
        # -----------------------------------------------------------
        try:
            await conn.execute("REFRESH MATERIALIZED VIEW inference_stats_hourly")
            print("Refreshed materialized view.")
        except Exception as e:
            print(f"Could not refresh materialized view (may not exist yet): {e}")

        # -----------------------------------------------------------
        # Summary
        # -----------------------------------------------------------
        print("")
        print("=" * 50)
        print("  Seed complete!")
        print("=" * 50)
        print(f"  Conversations:   {num_conversations}")
        print(f"  Messages:        {total_messages}")
        print(f"  Inference logs:  {total_logs}")
        print("")
        print("  Data spans the last 24 hours for dashboard appeal.")
        print("  Open http://localhost:3000 to see the dashboards.")

    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
