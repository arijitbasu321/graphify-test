import type { Runner, RunnerEvent, RunOptions } from './base';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Script = {
  toolCalls: Array<{ name: string; args: unknown }>;
  text: string;
  inputTokens: number;
  outputTokens: number;
};

const NAIVE_SCRIPT: Script = {
  toolCalls: [
    { name: 'Glob', args: { pattern: '**/*.{ts,tsx,js,jsx}' } },
    { name: 'Glob', args: { pattern: '**/auth/**' } },
    { name: 'Grep', args: { pattern: 'session|token|cookie' } },
    { name: 'Read', args: { file: 'src/middleware.ts' } },
    { name: 'Grep', args: { pattern: 'verifyToken' } },
    { name: 'Read', args: { file: 'src/auth/session.ts' } },
    { name: 'Read', args: { file: 'src/auth/jwt.ts' } },
    { name: 'Grep', args: { pattern: 'handleRequest' } },
    { name: 'Read', args: { file: 'src/api/routes.ts' } },
    { name: 'Bash', args: { cmd: 'rg -n "withAuth" --type ts' } },
    { name: 'Read', args: { file: 'src/api/handlers/login.ts' } },
    { name: 'Read', args: { file: 'src/api/handlers/logout.ts' } },
  ],
  text:
    `The auth flow centers on a JWT-based session middleware. Requests hit ` +
    `\`withAuth\` in \`src/api/routes.ts\`, which delegates to ` +
    `\`verifyToken\` in \`src/auth/jwt.ts\`. The session is read from a ` +
    `cookie via \`getSession\` in \`src/auth/session.ts\`, then validated ` +
    `against the signing key. If valid, the request proceeds to the handler; ` +
    `otherwise it returns 401.\n\n` +
    `Key files:\n` +
    `- \`src/middleware.ts\` — the entry point that wraps all authed routes\n` +
    `- \`src/auth/jwt.ts\` — token signing and verification\n` +
    `- \`src/auth/session.ts\` — cookie-backed session storage\n` +
    `- \`src/api/handlers/login.ts\` — issues a new token on credentials\n\n` +
    `Note: I had to grep across the repo and open several files to piece this ` +
    `together because there's no central architecture document.`,
  inputTokens: 18420,
  outputTokens: 412,
};

const GRAPH_SCRIPT: Script = {
  toolCalls: [
    { name: 'Read', args: { file: 'graphify-out/GRAPH_REPORT.md' } },
    { name: 'Read', args: { file: 'src/auth/jwt.ts' } },
    { name: 'Read', args: { file: 'src/auth/session.ts' } },
  ],
  text:
    `The auth flow is a JWT-based session middleware. Per the graph, the entry ` +
    `point is \`withAuth\` (\`src/api/routes.ts:42\`), which calls ` +
    `\`verifyToken\` (\`src/auth/jwt.ts:18\`). Session state is read from a ` +
    `cookie by \`getSession\` (\`src/auth/session.ts:24\`) and validated ` +
    `against the HS256 signing key.\n\n` +
    `Key files:\n` +
    `- \`src/middleware.ts:11\` — wraps all authed routes\n` +
    `- \`src/auth/jwt.ts:18\` — \`verifyToken\` / \`signToken\`\n` +
    `- \`src/auth/session.ts:24\` — cookie-backed session\n` +
    `- \`src/api/handlers/login.ts:9\` — credential exchange\n\n` +
    `The graph surfaced the call edges (\`withAuth → verifyToken → ` +
    `getSession\`) directly, so I only needed to open the two files that ` +
    `implement the verification logic to confirm the algorithm.`,
  inputTokens: 6240,
  outputTokens: 318,
};

async function* runScript(script: Script): AsyncGenerator<RunnerEvent> {
  const t0 = Date.now();
  // initial small delay before first activity
  await sleep(180);

  const text = script.text;
  let toolIdx = 0;
  let charIdx = 0;
  // approximate: emit a tool call every ~22 chars, capped by tools.length
  const charsPerTool = Math.max(8, Math.floor(text.length / (script.toolCalls.length + 1)));

  while (charIdx < text.length || toolIdx < script.toolCalls.length) {
    // emit a tool call when we cross the next threshold
    if (toolIdx < script.toolCalls.length && charIdx >= toolIdx * charsPerTool) {
      yield { type: 'tool_call', payload: script.toolCalls[toolIdx] };
      toolIdx++;
      // simulate tool latency before next text
      await sleep(120);
    }

    if (charIdx < text.length) {
      // emit small text chunks (3–6 chars) at ~30ms cadence
      const chunkSize = 3 + Math.floor(Math.random() * 4);
      const delta = text.slice(charIdx, charIdx + chunkSize);
      charIdx += chunkSize;
      yield { type: 'text', payload: { delta } };
      await sleep(28);
    } else {
      // text done but tools remain — flush them
      while (toolIdx < script.toolCalls.length) {
        yield { type: 'tool_call', payload: script.toolCalls[toolIdx] };
        toolIdx++;
        await sleep(60);
      }
    }
  }

  yield {
    type: 'token_usage',
    payload: { input: script.inputTokens, output: script.outputTokens },
  };

  yield {
    type: 'done',
    payload: {
      totals: {
        tools: script.toolCalls.length,
        inputTokens: script.inputTokens,
        outputTokens: script.outputTokens,
        latencyMs: Date.now() - t0,
      },
    },
  };
}

export const mockRunner: Runner = {
  id: 'mock',
  run({ variant }: RunOptions) {
    const script = variant === 'graph' ? GRAPH_SCRIPT : NAIVE_SCRIPT;
    return runScript(script);
  },
};
