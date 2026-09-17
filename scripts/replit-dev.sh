#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -n "${api_pid:-}" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

PORT=3000 pnpm --filter @workspace/api-server run dev &
api_pid=$!

PORT=5000 pnpm --filter @workspace/tech-dashboard run dev