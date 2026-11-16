# supio-cms: common development commands. Run `make` (or `make help`) to list them.
#
# Database safety: Payload commands use DATABASE_URI from your shell, or else from .env.local.
# Commands that change a database show its host and ask before running.

SHELL := /bin/bash
.DEFAULT_GOAL := help

ENV_FILE := .env.local
# value of KEY in .env.local (empty if the file or key is missing)
env_value = $(shell [ -f $(ENV_FILE) ] && sed -nE 's/^$(1)=["]?([^"]*)["]?$$/\1/p' $(ENV_FILE) | tail -1)

# ---- tunnel ----
# The ngrok domain comes from SERVER_URL in .env.local; override with `make tunnel NGROK_DOMAIN=…`.
NGROK_DOMAIN ?= $(patsubst https://%,%,$(patsubst %/,%,$(call env_value,SERVER_URL)))
PORT ?= 3000
# Authtoken: NGROK_AUTHTOKEN from your shell, else from .env.local, else ngrok's own saved config.
NGROK_AUTHTOKEN ?= $(call env_value,NGROK_AUTHTOKEN)
# Passed via the environment (never printed); left out when empty so ngrok's saved config still works.
NGROK_ENV = $(if $(NGROK_AUTHTOKEN),NGROK_AUTHTOKEN='$(NGROK_AUTHTOKEN)')

# ---- database ----
DATABASE_URI_EFFECTIVE := $(or $(DATABASE_URI),$(call env_value,DATABASE_URI))
DB_HOST := $(shell echo '$(DATABASE_URI_EFFECTIVE)' | sed -nE 's|^[a-z]+://([^@]*@)?([^/:?]+).*|\2|p')

# ---- local throwaway test database (Postgres.app binaries, separate port and data dir) ----
PG_BIN ?= /Applications/Postgres.app/Contents/Versions/latest/bin
TEST_DB_DIR ?= .testdb
TEST_DB_PORT ?= 54329
TEST_DB_NAME ?= supio_test
TEST_DATABASE_URI ?= postgres://postgres@localhost:$(TEST_DB_PORT)/$(TEST_DB_NAME)

define confirm_db
	@echo "Database host: $(if $(DB_HOST),$(DB_HOST),(not set))"
	@read -r -p "$(1) on this database? [y/N] " ans && [ "$$ans" = "y" ] || { echo "Cancelled."; exit 1; }
endef

.PHONY: help
help: ## Show this list
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2} /^## / {printf "\n\033[1m%s\033[0m\n", substr($$0, 4)}' $(MAKEFILE_LIST)
	@echo

## Setup
.PHONY: install
install: ## Install dependencies (pnpm, frozen lockfile)
	pnpm install --frozen-lockfile

## Develop
.PHONY: dev dev-clean tunnel up
dev: ## Start the backend dev server (http://localhost:3000, or PORT=…)
	PORT=$(PORT) pnpm dev

dev-clean: ## Clear the .next cache, then start the dev server
	PORT=$(PORT) pnpm devsafe

tunnel: ## Start the ngrok tunnel to the dev server (domain from SERVER_URL in .env.local)
	@command -v ngrok >/dev/null || { echo "ngrok is not installed: brew install ngrok"; exit 1; }
	@[ -n "$(NGROK_DOMAIN)" ] || { echo "Set SERVER_URL=https://<your-domain>.ngrok-free.app in $(ENV_FILE), or run: make tunnel NGROK_DOMAIN=<domain>"; exit 1; }
	@case "$(NGROK_DOMAIN)" in http://*|localhost*|127.0.0.1*) echo "SERVER_URL must be your https ngrok URL, not $(NGROK_DOMAIN)"; exit 1;; esac
	@echo "ngrok http --url=$(NGROK_DOMAIN) $(PORT)"
	@$(NGROK_ENV) ngrok http --url=$(NGROK_DOMAIN) $(PORT)

up: ## Start the dev server and the tunnel together (Ctrl+C stops both)
	@command -v ngrok >/dev/null || { echo "ngrok is not installed: brew install ngrok"; exit 1; }
	@[ -n "$(NGROK_DOMAIN)" ] || { echo "Set SERVER_URL in $(ENV_FILE) first (see .env.example)"; exit 1; }
	@echo "Backend: https://$(NGROK_DOMAIN)  (local: http://localhost:$(PORT))"
	@trap 'kill 0' INT TERM EXIT; \
	  $(NGROK_ENV) ngrok http --url=$(NGROK_DOMAIN) $(PORT) --log=stdout --log-level=warn & \
	  PORT=$(PORT) pnpm dev

## Code quality
.PHONY: lint typecheck check
lint: ## Run ESLint
	pnpm lint

typecheck: ## Type-check without emitting files
	pnpm exec tsc --noEmit -p .

check: typecheck lint ## Type-check and lint

## Payload
.PHONY: types importmap
types: ## Regenerate src/payload-types.ts after changing collections
	pnpm generate:types

importmap: ## Regenerate the admin import map after adding admin components
	pnpm generate:importmap

## Migrations (production applies them automatically on deploy)
.PHONY: migrate-create migrate-status migrate migrate-down
migrate-create: ## Create a migration from schema changes: make migrate-create name=add_something
	@[ -n "$(name)" ] || { echo "Usage: make migrate-create name=short_description"; exit 1; }
	pnpm payload migrate:create $(name)

migrate-status: ## Show which migrations have run
	@echo "Database host: $(if $(DB_HOST),$(DB_HOST),(not set))"
	pnpm payload migrate:status

migrate: ## Run pending migrations (asks first)
	$(call confirm_db,Run pending migrations)
	pnpm payload migrate

migrate-down: ## Roll back the last migration (asks first)
	$(call confirm_db,ROLL BACK the last migration)
	pnpm payload migrate:down

## Tests
.PHONY: test test-int test-e2e test-db-up test-db-down test-db-reset
test: test-db-up test-int ## Start the local test database and run the integration tests

test-int: ## Run integration tests against TEST_DATABASE_URI (never your dev/prod DB)
	TEST_DATABASE_URI=$(TEST_DATABASE_URI) pnpm test:int

test-e2e: ## Run the Playwright end-to-end tests
	pnpm test:e2e

test-db-up: ## Start a throwaway local Postgres for tests (.testdb/, port 54329)
	@[ -x "$(PG_BIN)/pg_ctl" ] || { echo "Postgres binaries not found in $(PG_BIN). Install Postgres.app or set PG_BIN=…"; exit 1; }
	@[ -d "$(TEST_DB_DIR)" ] || "$(PG_BIN)/initdb" -D "$(TEST_DB_DIR)" -U postgres --auth=trust >/dev/null
	@"$(PG_BIN)/pg_ctl" -D "$(TEST_DB_DIR)" status >/dev/null 2>&1 || \
	  "$(PG_BIN)/pg_ctl" -D "$(TEST_DB_DIR)" -o "-p $(TEST_DB_PORT) -c unix_socket_directories=''" -l "$(TEST_DB_DIR)/server.log" -w start >/dev/null
	@"$(PG_BIN)/psql" -h localhost -p $(TEST_DB_PORT) -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$(TEST_DB_NAME)'" | grep -q 1 || \
	  "$(PG_BIN)/createdb" -h localhost -p $(TEST_DB_PORT) -U postgres $(TEST_DB_NAME)
	@echo "Test database ready: $(TEST_DATABASE_URI)"

test-db-down: ## Stop the local test Postgres
	@[ -d "$(TEST_DB_DIR)" ] && "$(PG_BIN)/pg_ctl" -D "$(TEST_DB_DIR)" stop >/dev/null 2>&1 && echo "Test database stopped." || echo "Test database is not running."

test-db-reset: test-db-down ## Delete the local test database completely
	rm -rf "$(TEST_DB_DIR)"

## Build
.PHONY: build start
build: ## Production build
	pnpm build

start: ## Run the production build locally
	PORT=$(PORT) pnpm start
