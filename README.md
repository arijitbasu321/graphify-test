# graphify-compare

Side-by-side comparison UI: query an unfamiliar codebase via the Claude Code CLI with and without a `graphify-out/` knowledge graph. Two panels stream the same prompt against the same CLI; the only difference is whether the working tree has the graph.

## Run

```bash
npm install

# mock runner (no CLI required, canned events, useful for UI work)
RUNNER=mock npm run dev

# real claude CLI subprocess
RUNNER=claude_code npm run dev
```

Open http://localhost:3000.

The naive path must NOT contain `graphify-out/`. The graph path must contain `graphify-out/GRAPH_REPORT.md`. Use two clones of the same repo — run `/graphify .` in one of them first.

## Stack

- Next.js 14 App Router · TypeScript · Tailwind · Geist
- SSE streaming, no LLM SDK, no API keys (subprocess only)

## Spec

See [`lot.md`](lot.md) for the full project brief.
