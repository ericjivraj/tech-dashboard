#!/usr/bin/env bash
set -euo pipefail

echo "Running codegen..."
pnpm --filter @workspace/api-spec run codegen

echo ""
echo "Checking for drift in generated files..."

DRIFT_FOUND=0

declare -a DIRS=(
  "lib/api-client-react/src/generated/"
  "lib/api-client-react/dist/"
  "lib/api-zod/src/generated/"
)

for dir in "${DIRS[@]}"; do
  if ! git diff --exit-code "$dir" > /dev/null 2>&1; then
    echo ""
    echo "  OUT OF SYNC: $dir"
    git diff --name-only "$dir"
    DRIFT_FOUND=1
  fi
done

if [ "$DRIFT_FOUND" -eq 1 ]; then
  echo ""
  echo "ERROR: Generated files are out of sync with openapi.yaml."
  echo "Run 'pnpm --filter @workspace/api-spec run codegen' and commit the result."
  exit 1
fi

echo "No drift detected — generated files are up to date."
