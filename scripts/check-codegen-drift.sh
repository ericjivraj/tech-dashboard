#!/usr/bin/env bash
set -euo pipefail

echo "Running Orval to check for codegen drift..."

# Run only Orval (no TypeScript build, no typecheck) against the real output dirs.
# This is fast (a few seconds) and still catches any drift between openapi.yaml
# and the generated source files.
(cd lib/api-spec && pnpm exec orval --config ./orval.config.ts)

# Also regenerate the api-zod barrel export (mirrors what full codegen does)
node -e "require('fs').writeFileSync('lib/api-zod/src/index.ts', 'export * from \"./generated/api\";\n')"

echo ""
echo "Checking for drift in generated files..."

DRIFT_FOUND=0

declare -a DIRS=(
  "lib/api-client-react/src/generated/"
  "lib/api-zod/src/generated/"
  "lib/api-zod/src/index.ts"
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
