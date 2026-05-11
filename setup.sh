#!/usr/bin/env bash
# graphify-compare cold-start: verify deps, install, report runner readiness.
# Safe to re-run.

set -e

cd "$(dirname "$0")"

GREEN=$'\033[32m'
RED=$'\033[31m'
DIM=$'\033[2m'
RESET=$'\033[0m'

ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
fail() { printf '%s✗%s %s\n' "$RED" "$RESET" "$1"; }
note() { printf '%s%s%s\n'   "$DIM" "$1" "$RESET"; }

echo "graphify-compare · setup"
echo

# --- Node version check ----------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  fail "node not installed (need >= 18). Install from https://nodejs.org or via nvm."
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "node $(node -v) is too old (need >= 18)."
  exit 1
fi
ok "node $(node -v)"

# --- Install deps -----------------------------------------------------------
if [ -d node_modules ] && [ -f node_modules/.package-lock.json ]; then
  note "node_modules present — skipping install (delete to force reinstall)"
else
  echo "installing npm packages..."
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi
ok "dependencies installed"

# --- Typecheck (fast sanity) -----------------------------------------------
if npx --no-install tsc --noEmit >/dev/null 2>&1; then
  ok "typecheck passes"
else
  fail "typecheck failed — run: npx tsc --noEmit"
fi

echo
echo "runner availability"
echo "-------------------"

check_cli() {
  local bin="$1" label="$2"
  if command -v "$bin" >/dev/null 2>&1; then
    local ver
    ver=$("$bin" --version 2>&1 | head -1)
    ok "$label · $ver"
  else
    fail "$label · not installed"
    case "$bin" in
      claude)
        note "    install: https://docs.claude.com/en/docs/claude-code"
        ;;
      copilot)
        note "    install: npm install -g @github/copilot   (then run \`copilot\` once and /login)"
        ;;
    esac
  fi
}

check_cli claude  "claude_code"
check_cli copilot "copilot_cli"
ok "mock         · always available (canned demo data)"

echo
echo "next steps"
echo "----------"
echo "  RUNNER=mock         npm run dev   # canned demo, no CLI required"
echo "  RUNNER=claude_code  npm run dev   # spawns the claude CLI"
echo "  RUNNER=copilot_cli  npm run dev   # spawns the copilot CLI"
echo
echo "  open http://localhost:3000 — switch runners from the dropdown in the header."
echo
echo "tip: paste two paths — one fresh clone (naive) and one with graphify-out/ (graph)."
