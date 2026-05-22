#!/bin/sh
set -e

# Render/Heroku give postgres:// but asyncpg needs postgresql+asyncpg://
case "$DATABASE_URL" in
  postgres://*) export DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#postgres://}" ;;
  postgresql://*) export DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#postgresql://}" ;;
esac

# asyncpg uses ssl=true, not sslmode=require
export DATABASE_URL=$(echo "$DATABASE_URL" | sed 's|?sslmode=[a-z]*|?ssl=true|')

echo "Running database migrations..."
alembic upgrade head

echo "Starting backend server..."
exec uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-8000}"
