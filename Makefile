.PHONY: up down logs test reset migrate build

up:
	docker compose up --build -d
	@echo "Waiting for services to be healthy..."
	@sleep 8
	docker compose run --rm migrate
	@echo ""
	@echo "Ready! Open http://localhost:3000"

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose run --rm backend pytest -v
	docker compose run --rm worker pytest -v

reset:
	docker compose down -v
	$(MAKE) up

migrate:
	docker compose run --rm migrate

build:
	docker compose build
