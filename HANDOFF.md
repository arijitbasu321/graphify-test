# Dev handoff

For someone picking up the codebase to extend or fix it. Assumes you've run `./setup.sh`.

## What this is

A single-page web app that runs the same prompt against the same coding-agent CLI in two parallel panels — one cwd has `graphify-out/`, the other doesn't — and streams tool calls + tokens + latency live for each side. Aggregate strip at the bottom tracks cumulative tokens saved across queries.

No database. No persisted state. No LLM SDK. Subprocess-only. Session lives entirely in React.

## Layout

```
app/                  Next.js App Router
  layout.tsx          Geist fonts + global CSS
  page.tsx            client component — top-level state, orchestrates two SSE streams
  globals.css         design tokens + markdown styles
  api/
    naive/route.ts    POST → SSE; validates "no graphify-out/"
    graph/route.ts    POST → SSE; requires graphify-out/GRAPH_REPORT.md
    detect/route.ts   GET ?path=... → does graphify-out/ exist? (used by top-bar)
    runner-info/      GET → which CLIs are installed (probes --version in parallel)
backend/
  api/sse.ts          shared SSE plumbing + body parsing + repo validation
  runners/
    base.ts           Runner interface + RunnerEvent union (the contract)
    index.ts          registry, default-runner-from-env, getRunner(id)
    mock.ts           canned events, no subprocess
    claude_code.ts    spawns `claude -p ... --output-format stream-json`, parses NDJSON
    copilot_cli.ts    spawns `copilot -p ... --allow-all`, streams stdout as text
components/           presentational React
  TopBar.tsx          inputs + run button + RunnerSelect + per-path detect line
  Panel.tsx           one of the two streaming panels
  ToolLog.tsx         collapsible monospace tool-call list
  AggregateStrip.tsx  sticky bottom strip
  RunnerSelect.tsx    native <select> dropdown
  CountUp.tsx         rAF count-up animation
  Markdown.tsx        react-markdown wrapper with the .md class
lib/
  sse.ts              client-side fetch+ReadableStream consumer (POST → SSE)
  state.ts            React state types and initial values
  format.ts           tabular formatting helpers
setup.sh              cold-start script
lot.md                original project brief
```

## The runner contract

This is the only thing you need to understand to add a new backend.

```ts
// backend/runners/base.ts
export type RunnerEvent =
  | { type: 'tool_call'; payload: { name: string; args: unknown } }
  | { type: 'text';      payload: { delta: string } }
  | { type: 'token_usage'; payload: { input: number; output: number } }
  | { type: 'error';     payload: { message: string } }
  | { type: 'done';      payload: { totals: { tools: number; inputTokens: number; outputTokens: number; latencyMs: number } } }

export interface Runner {
  readonly id: 'mock' | 'claude_code' | 'copilot_cli';
  run(opts: { prompt: string; cwd: string; variant: 'naive' | 'graph'; signal?: AbortSignal }): AsyncIterable<RunnerEvent>;
}
```

Yield events as they happen. Always end with one `done` event (even on error — emit `error` then `done`). Token usage is optional — emit zero if your CLI doesn't report it; the UI will render `—`.

## Adding a new runner

1. Create `backend/runners/foo.ts`, export a `Runner` with id `'foo'`.
2. In `backend/runners/index.ts`:
   - Add `'foo'` to the `RunnerId` union and `RUNNER_IDS` array.
   - Add an entry to the `REGISTRY` record.
   - Update `isRunnerId` guard.
3. In `app/api/runner-info/route.ts`:
   - Add a `checkCli('foo', ['--version'])` to the parallel probe and include it in the runners array.
4. In `components/RunnerSelect.tsx`:
   - Add a label for `foo` in the `LABEL` map.

The UI dropdown picks it up automatically once `runner-info` returns it.

## How the two panels stay independent

`app/page.tsx` calls `streamPost('/api/naive', …)` and `streamPost('/api/graph', …)` in parallel via the same `AbortController`. Each fetch is a separate POST whose response is an SSE stream. The shared `lib/sse.ts` parses `data: <json>\n\n` frames into `RunnerEvent`s and dispatches into `setNaive` / `setGraph`. Aggregation happens once both sides emit `done`.

Reset (or starting a new run) calls `abortRef.current?.abort()` first, which cancels the fetch and the server's `ReadableStream`. The runner's abort signal propagates into the subprocess — `claude_code.ts` and `copilot_cli.ts` both wire `signal.addEventListener('abort', () => child.kill('SIGTERM'))`.

## Validation rules

In `backend/api/sse.ts → validateRepoPath`. These are the only places the API will return 400:

- path missing or not absolute
- path doesn't exist or isn't a directory
- naive endpoint sees `graphify-out/`
- graph endpoint sees no `graphify-out/GRAPH_REPORT.md`

If you change a rule, also update `DetectLine` in `TopBar.tsx` so the live indicator under the path inputs matches.

## Design tokens

In `tailwind.config.ts` and `app/globals.css`. Don't introduce new colors casually — the palette is intentionally tiny:

- backgrounds: `bg`, `s1`, `s2` (warm dark neutrals)
- borders: `bsubtle`, `bdefault`
- text: `tprimary`, `tsecondary`, `ttertiary`
- accent: `gold` — used **only** on the graph side and on the "tokens saved" counter
- error: `danger` (warm red)

No blues, no greens, no gradients, no shadows. Geist Sans for UI, Geist Mono with `tnum` for numbers/code.

## Local dev

```bash
RUNNER=mock npm run dev          # iterate on UI without spawning real CLIs
RUNNER=claude_code npm run dev   # real claude
RUNNER=copilot_cli npm run dev   # real copilot
```

The dropdown in the UI overrides the env default per-request, so you don't need to restart to switch.

Useful direct probes for debugging:

```bash
curl -s http://localhost:3000/api/runner-info | python3 -m json.tool
curl -s "http://localhost:3000/api/detect?path=/tmp/foo"
curl -sN -X POST http://localhost:3000/api/graph \
  -H 'Content-Type: application/json' \
  -d '{"repoPath":"/tmp/foo-graph","prompt":"hi","runner":"mock"}'
```

## Known sharp edges

- **Copilot CLI tool-call detection is heuristic.** The regex in `copilot_cli.ts` matches `● Read(...)` / `Tool: Bash(...)` style lines. If real `copilot -p` output uses different chrome, the tool-count column will under-report. Send a sample of real stdout and tighten the regex.
- **Copilot doesn't expose token counts.** `inputTokens`/`outputTokens` always 0 → UI shows `—`. The aggregate strip's "tokens saved" math will be 0 for any query that ran on copilot. Don't mix-and-match runners across queries within a session if you care about cumulative numbers.
- **Global Claude PreToolUse hook fires on both panels.** Per the spec this is fine — the hook is a no-op when `graphify-out/graph.json` is absent — but if you're debugging unexpected naive-side behavior, check `~/.claude/hooks/`.
- **Two repo paths required.** Naive needs a clone *without* `graphify-out/`; graph needs one *with*. The same path can't satisfy both. We deliberately did not auto-copy/strip on the server; do it manually with `rsync -a --exclude=graphify-out --exclude=node_modules ...`.
- **No history.** Refresh wipes everything. Per spec — no DB, no persistence.

## Quick checks before pushing

```bash
npx tsc --noEmit   # zero errors expected
./setup.sh         # should print all-green
```

There are no automated tests. The UI is dense enough that a manual run with the mock runner usually catches regressions in <30 seconds: type any path that exists into both fields (mock doesn't validate), type any prompt, click run, watch both panels stream and the aggregate strip update.
