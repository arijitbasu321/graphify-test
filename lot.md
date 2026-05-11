PROJECT: Build a side-by-side comparison UI that demonstrates the value of graphify when querying an unfamiliar codebase. The demo target audience is a VP — the UI needs to be credible, dense, and slop-free.

================================================================================
PART 1 — CONCEPT
================================================================================

User pastes a local filesystem path to a code repo + types a question. Two panels run the same question through the same AI assistant CLI, but:
- LEFT panel (NAIVE): assistant works on the raw codebase, no graphify
- RIGHT panel (GRAPH): assistant works on the codebase with graphify-out/ available (GRAPH_REPORT.md + graph.json + the PreToolUse hook + CLAUDE.md)

For each panel, stream the output live and track:
- Tool calls (Read, Grep, Glob, Bash, etc.) with running count
- Input tokens, output tokens, total tokens
- Wall-clock latency
- Final answer text (markdown-rendered)

At the bottom of the page, a sticky aggregate strip:
- Cumulative tokens saved this session
- % reduction
- Total queries asked
- Avg savings per query
- Reset session button

================================================================================
PART 2 — STACK
================================================================================

- Next.js 14, App Router, TypeScript
- Tailwind CSS for styling
- Server-Sent Events for streaming both panels independently
- Geist font (npm install geist) — sans for UI, mono for counters/code/tool calls
- No database. Session state lives in React only. Persist nothing.
- No LLM SDK. No ANTHROPIC_API_KEY. Subprocess only.

================================================================================
PART 3 — ARCHITECTURE
================================================================================

backend/runners/
  base.ts         — interface Runner {
                      run(prompt: string, cwd: string): AsyncIterable<RunnerEvent>
                    }
                    RunnerEvent =
                      | { type: 'tool_call', payload: { name: string, args: any } }
                      | { type: 'text', payload: { delta: string } }
                      | { type: 'token_usage', payload: { input: number, output: number } }
                      | { type: 'error', payload: { message: string } }
                      | { type: 'done', payload: { totals: { tools: number, inputTokens: number, outputTokens: number, latencyMs: number } } }

  claude_code.ts  — spawns `claude -p "<prompt>" --output-format stream-json --verbose`
                    Parses NDJSON line-by-line. Each line is a JSON event with a type
                    field: system, assistant, user (with tool_use_id), result. Extract:
                      - tool calls from assistant messages with tool_use content blocks
                      - text from assistant messages with text content blocks (emit as deltas)
                      - token usage from the final `result` event
                    Emit RunnerEvents as you parse.

  copilot_cli.ts  — spawns `copilot -p "<prompt>" [--format json if supported]`
                    Stub for now. Return a single 'error' event saying "not yet implemented."
                    We'll wire this up later when running in office.

  mock.ts         — emits canned events with realistic delays (text deltas every 30ms,
                    tool calls every 800ms, final done after ~6 seconds). Used to build
                    the UI before touching real CLIs.

  Runner selection: env var RUNNER=claude_code|copilot_cli|mock. Default: mock.
  Show the active runner in a small badge in the UI top bar.

backend/api/
  naive/route.ts  — POST { repoPath, prompt } → SSE stream
                    - Validate repoPath exists, is a directory
                    - FAIL if graphify-out/ exists in repoPath: 400 with clear message
                      "This is the naive baseline — repo must NOT have graphify-out/. Run on a fresh clone."
                    - Spawn runner with cwd = repoPath
                    - Pipe runner events as SSE messages
                    - Close stream on done or error

  graph/route.ts  — POST { repoPath, prompt } → SSE stream
                    - Validate repoPath exists, is a directory
                    - FAIL if graphify-out/GRAPH_REPORT.md does NOT exist: 400 with message
                      "Repo missing graphify-out/. Run `/graphify .` in the repo first."
                    - Spawn runner with cwd = repoPath
                    - Same SSE event shape as naive endpoint
                    - The PreToolUse hook + CLAUDE.md should already be installed globally,
                      so Claude will naturally read GRAPH_REPORT.md before grepping. We don't
                      do anything special here — the hook does the work.

Both endpoints emit identical SSE event shapes so the frontend renders them identically.

================================================================================
PART 4 — FRONTEND
================================================================================

Single page at /. Three sections:

(1) TOP BAR
  - Text input: "repo path" (e.g. /Users/you/code/some-repo)
  - Text input: "question" (multiline, grows to 3 rows max)
  - "Run" button (primary, neutral white-on-dark)
  - Runner badge: small pill showing "claude_code" or "copilot_cli" or "mock"
  - Indicator showing whether the pasted path has graphify-out/ detected
    (subtle text, not a big banner)

(2) TWO PANELS, side-by-side, equal width
  Each panel shows, top to bottom:
  - Header row: panel label ("NAIVE" / "GRAPH"), runner badge inline
  - Divider (hairline)
  - Streaming answer area (markdown-rendered, grows with content)
  - Collapsible tool-call log (default collapsed): each entry "Grep('handler')",
    "Read(src/auth.js)", "Bash(ls -la)", etc. — monospace, dense.
  - Counter footer: 3 columns — tool calls / tokens / latency. Monospace,
    tabular-nums, labels in tertiary color above each number.

(3) BOTTOM AGGREGATE STRIP (sticky)
  - "Tokens saved this session: X (Y%)"
  - "Queries asked: N"
  - "Avg savings per query: X tokens"
  - Reset session button (text-only, tertiary)

================================================================================
PART 5 — DESIGN (grounded in Vercel Geist + Linear's 2025 refresh)
================================================================================

This must look like a 2026 developer tool. Reference aesthetic: vercel.com/geist
and Linear's current app. NOT like an AI demo. The reduction is the point —
"premium" comes from what you remove, not what you add.

TYPOGRAPHY:
Use the Geist font family (free, OFL). Install:
  npm install geist
Then:
  import { GeistSans } from 'geist/font/sans'
  import { GeistMono } from 'geist/font/mono'
  // attach to <html className={`${GeistSans.variable} ${GeistMono.variable}`}>
- Body: GeistSans, weight 400, never above 500 in UI
- Numbers and code: GeistMono with font-feature-settings: 'tnum' on (tabular nums)
- Sizes: 13px body, 12px metadata, 11px tertiary (timestamps), 14px section headers
- No 24px+ text anywhere. This is a tool. Headers are 14px medium, not hero text.
- Line height: 1.55 body, 1.4 mono
- Letter spacing: -0.011em on UI text. Default on mono.

PALETTE (warm neutrals, not blue-shifted — match Linear's 2025 shift):
- Background: #0A0A0A
- Surface 1: #141414 (panels, cards)
- Surface 2: #1C1C1C (hover state, raised elements)
- Border subtle: #232323
- Border default: #2E2E2E
- Text primary: #EDEDED
- Text secondary: #A1A1A1
- Text tertiary: #6E6E6E

SEMANTIC COLOR (used ONLY when it carries meaning, never decoratively):
- Naive panel accent: #E5484D (muted red) — applied only to:
  the panel's left border (2px), the running token counter color, the "NAIVE" label
- Graph panel accent: #46A758 (muted green) — same applications
- Neutral CTA (Run button): #EDEDED bg, #0A0A0A text. Inverts on hover.
- Error: #E5484D. Success indicators: #46A758. Nothing else gets color.

FORBIDDEN:
- Pure black #000 (use #0A0A0A — Linear-style warm neutral, never the cold pure)
- Blue/purple anywhere
- Gradients of any kind (background, border, text)
- Box shadows for elevation (use background contrast instead)
- Glassmorphism, backdrop blur
- Rounded-2xl, pill shapes (except status dots)
- Emoji in UI
- Decorative icons (only functional: chevron, x-close, copy)
- "Powered by AI" or any AI-cliche language
- Shimmer skeleton loaders (use "—" placeholder instead)
- Hero typography
- Card shadows
- Tooltip drop-shadows

LAYOUT:
- Spacing scale: 4, 8, 12, 16, 24, 32 (8px-base with 4px and 12px allowed)
- Border radius: 4px on cards/inputs/buttons. 2px on inline elements like badges.
  Never 0px (too brutalist for a streaming dashboard), never 8px+ (too soft).
- Borders: 1px solid. Never 2px. Use border-subtle for hairlines, border-default
  for delineation.
- Density over whitespace. Pack info in. This is for developers, not landing-page
  visitors.

PANEL STRUCTURE:
- Each comparison panel: 1px border-default, 4px radius, surface-1 bg
- 2px colored left edge (red for naive, green for graph) — the ONLY decorative
  color in the panel itself
- Inside the panel: header row (panel label, runner badge), then divider
  (border-subtle), then streaming answer area, then tool log (collapsible), then
  counter footer
- Counter footer: GeistMono, tabular-nums, three columns: tool calls / tokens /
  latency. Each label is text-tertiary 11px. Each number is text-primary 13px.

INTERACTIONS:
- Hover: lighten background by ~6% (surface-1 → surface-2). No transform, no glow.
- Active: 100ms snap to inverted colors
- Transitions: 120ms ease-out, ONLY on background-color, color, and opacity.
  Nothing else animates.
- Streaming text: appears character-by-character as SSE events arrive. No fake
  typewriter — render whatever the buffer has on each tick.
- Counter increments: animate via React state, smooth count-up over ~150ms using
  requestAnimationFrame. No "flying numbers."

SELF-CHECK BEFORE FIRST RENDER:
Describe the page in 3 sentences as if to a senior frontend engineer who has
worked at Vercel or Linear. If your description includes "modern," "sleek,"
"beautiful," "stunning," "gradient," "glowing," or "vibrant," scrap it and
rewrite. The correct adjectives are: "dense," "restrained," "monochrome,"
"hairline," "tabular," "quiet."

REFERENCE LINKS (open these and study before writing CSS):
- https://vercel.com/geist/colors
- https://vercel.com/geist/typography
- https://linear.app/now/behind-the-latest-design-refresh
- https://linear.app/

================================================================================
PART 6 — IMPLEMENTATION ORDER
================================================================================

(1) Scaffold Next.js + Tailwind + TypeScript + Geist. Empty layout with the three
    section shells (top bar, two empty panels, aggregate strip).
(2) Define base.ts interface. Implement mock.ts runner that emits canned events
    with realistic timing.
(3) Wire both API routes to use the mock runner. Confirm both panels stream
    correctly end-to-end. Test the aggregate strip math.
(4) Implement claude_code.ts. Use `claude -p "<prompt>" --output-format stream-json
    --verbose`. Parse NDJSON. Map to RunnerEvents.
(5) Test against a real repo. Confirm tool calls + tokens are correctly extracted.
(6) Leave copilot_cli.ts as a stub. We'll do that later in office.

================================================================================
PART 7 — FAIL EARLY, FAIL LOUD
================================================================================

- If repoPath doesn't exist: 400 with clear message.
- If naive endpoint sees graphify-out/ in the repo: 400, tell user to use a fresh clone.
- If graph endpoint doesn't see graphify-out/: 400, tell user to run /graphify first.
- If runner subprocess errors: stream the stderr as an 'error' event to the panel
  and stop cleanly. Don't crash the whole page.
- If the claude CLI isn't installed: detect this at startup and show a clear
  banner in the UI.

================================================================================
PART 8 — WHAT NOT TO DO
================================================================================

- Don't call any LLM SDK directly. No API keys anywhere. Subprocess only.
- Don't try to count tokens manually with tiktoken. Use what the CLI reports. If
  the CLI doesn't report, show "N/A" rather than fake numbers.
- Don't use a database. Don't persist anything.
- Don't render graphify itself — assume the user already ran `/graphify .` in the
  target repo before pasting the path.
- Don't add features I didn't ask for. No history view, no settings page, no auth,
  no telemetry, no dark mode toggle (it's always dark).

================================================================================
PART 9 — DELIVERABLE
================================================================================

A repo I can:
  git clone <repo>
  cd <repo>
  npm install
  RUNNER=mock npm run dev
  # → open localhost:3000, paste any directory path, ask any question,
  #   see two panels stream with mock data and the aggregate strip update.
Then:
  RUNNER=claude_code npm run dev
  # → same flow but real claude CLI subprocess + real token counts.

================================================================================
PART 10 — BEFORE YOU START
================================================================================

(1) Confirm `claude --version` works in your environment. If not, stop and tell me.
(2) Open https://vercel.com/geist/colors and https://linear.app/ and study the
    aesthetic for 2 minutes before writing any CSS.
(3) Write a 1-page plan: file structure, key types, the order you'll build things.
    Show me the plan before writing code.
(4) Ask any clarifying questions you have. Don't blast through assumptions.
