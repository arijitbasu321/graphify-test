# graphify-compare

Side-by-side comparison UI: ask the same question against the same coding-agent CLI in two parallel panels — one with a `graphify-out/` knowledge graph, one without. Live streams of tool calls, token usage, and latency. Aggregate strip tracks cumulative tokens saved.

## Cold start

```bash
git clone https://github.com/arijitbasu321/graphify-test.git
cd graphify-test
./setup.sh
RUNNER=mock npm run dev
```

The setup script verifies Node ≥ 18, installs deps (`npm ci` if a lockfile exists), runs a typecheck, and prints which runners are available on this machine.

Open http://localhost:3000.

## Runners

Switchable from a dropdown at the top of the UI; the env var `RUNNER` only sets the initial default.

| id | what it spawns | needs |
|----|----------------|-------|
| `mock` | nothing — canned demo events | nothing |
| `claude_code` | `claude -p <prompt> --output-format stream-json --verbose --model sonnet --dangerously-skip-permissions` | [Claude Code](https://docs.claude.com/en/docs/claude-code) installed and authenticated |
| `copilot_cli` | `copilot -p <prompt> --allow-all` | `npm i -g @github/copilot`, run `copilot` once and `/login`, active Copilot subscription |

Unavailable runners appear in the dropdown as "(unavailable)" and aren't selectable.

## Using it

Paste two paths into the top bar:

- **naive repo path** — fresh clone, must NOT contain `graphify-out/`
- **graph repo path** — same repo, with `graphify-out/` produced by `/graphify .`

Type a question and click run. Both panels stream simultaneously. Mid-stream the tool log is collapsible; on completion the per-panel footer shows tool count, tokens, and latency, and the sticky bottom strip updates the cumulative tokens-saved counter.

## Stack

- Next.js 14 App Router · TypeScript · Tailwind · Geist
- SSE streaming end-to-end; no LLM SDK; subprocess-only.

## Docs

- [`HANDOFF.md`](HANDOFF.md) — dev handoff: file layout, runner contract, how to add a new backend, sharp edges
- [`lot.md`](lot.md) — original project brief
