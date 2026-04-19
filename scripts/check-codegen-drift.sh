#!/usr/bin/env bash
set -euo pipefail

echo "Running codegen..."
pnpm --filter @workspace/api-spec run codegen

echo ""
echo "Checking for drift in generated files..."
if ! git diff --exit-code lib/api-client-react/src/generated/ lib/api-client-react/dist/ lib/api-zod/src/generated/; then
  echo ""
  echo "ERROR: Generated files are out of sync with openapi.yaml."
  echo "Run 'pnpm --filter @workspace/api-spec run codegen' and commit the result."
  exit 1
fi

echo "No drift detected — generated files are up to date."
