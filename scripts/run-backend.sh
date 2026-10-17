#!/usr/bin/env bash
# Starts the Spring Boot API with variables from ../.env (Git Bash, macOS or Linux).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
cd backend
exec mvn -q -B spring-boot:run
