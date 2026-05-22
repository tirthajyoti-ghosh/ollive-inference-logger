#!/bin/sh
set -e

# Render gives postgres:// but SQLAlchemy needs postgresql+asyncpg://
if echo "$DATABASE_URL" | grep -q '^postgres://'; then
  export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|^postgres://|postgresql+asyncpg://|')
fi
if echo "$DATABASE_URL" | grep -q '^postgresql://'; then
  export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|^postgresql://|postgresql+asyncpg://|')
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting backend server..."
exec uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-8000}"
