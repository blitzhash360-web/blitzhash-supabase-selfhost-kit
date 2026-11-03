.PHONY: up down doctor backup restore update setup test shellcheck

setup:
	./setup.sh -y

up:
	./bin/blitzhash-supabase up

down:
	./bin/blitzhash-supabase down

doctor:
	./bin/blitzhash-supabase doctor

backup:
	./bin/blitzhash-supabase backup

restore:
	@echo "Usage: make restore FILE=path/to/dump.sql.gz"; exit 1

update:
	./bin/blitzhash-supabase update

test:
	node --test test/*.test.mjs
	node --test services/functions-admin/test/*.test.mjs
	./scripts/ci-compose-validate.sh

shellcheck:
	shellcheck -e SC1091,SC2034 -x setup.sh bin/blitzhash-supabase scripts/*.sh scripts/lib/common.sh
