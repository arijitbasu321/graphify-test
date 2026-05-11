import { spawn } from 'node:child_process';
import type { Runner, RunnerEvent, RunOptions } from './base';

/**
 * Spawns `copilot -p "<prompt>" --allow-all`
 *
 * The Copilot CLI does not document a structured stream-json output as of writing,
 * so we stream stdout as text deltas. We additionally try to recognize tool-call
 * lines via a conservative regex (e.g. leading bullet followed by `Name(args)`).
 *
 * Token counts are not reported by the CLI in any documented form; the runner
 * emits zero usage so the UI shows "—".
 */

// Lines that look like a tool invocation in interactive-style output.
//   "● Read(file.ts)" / "→ Bash: ls -la" / "Tool: Grep('handler')"
const TOOL_LINE_RE =
  /^\s*(?:[●▶→•\-*]\s*)?(?:tool:\s*)?([A-Z][A-Za-z0-9_]{1,30})\s*[(:](.+?)\)?\s*$/i;

const TEXT_FLUSH_INTERVAL_MS = 50;

// Strip ANSI escape codes (color, cursor moves) from CLI output so they don't
// render as garbage in the panel.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

async function* runCopilot(opts: RunOptions): AsyncGenerator<RunnerEvent> {
  const t0 = Date.now();
  const args = ['-p', opts.prompt, '--allow-all'];

  const child = spawn('copilot', args, {
    cwd: opts.cwd,
    // Disable color so we get clean text without ANSI escapes (NO_COLOR is the
    // de-facto cross-tool standard; FORCE_COLOR=0 also helps for Node-based CLIs).
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (opts.signal) {
    const onAbort = () => { try { child.kill('SIGTERM'); } catch {} };
    if (opts.signal.aborted) onAbort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  const queue: RunnerEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;
  let stderr = '';
  let toolCount = 0;
  let textBuf = '';

  const push = (e: RunnerEvent) => {
    queue.push(e);
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  };

  const flushText = () => {
    if (!textBuf) return;
    push({ type: 'text', payload: { delta: textBuf } });
    textBuf = '';
  };

  let lineBuf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    lineBuf += stripAnsi(chunk);
    let nl;
    while ((nl = lineBuf.indexOf('\n')) >= 0) {
      const line = lineBuf.slice(0, nl);
      lineBuf = lineBuf.slice(nl + 1);
      processLine(line + '\n');
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c: string) => { stderr += stripAnsi(c); });

  function processLine(line: string) {
    // Try to detect a tool-call line. If matched, surface as tool_call.
    const trimmed = line.trim();
    const m = trimmed && TOOL_LINE_RE.exec(trimmed);
    if (m && /^(Read|Write|Edit|Grep|Glob|Bash|Run|LS|List|Search|Fetch|WebFetch|WebSearch|Tool)$/i.test(m[1])) {
      flushText();
      toolCount++;
      push({ type: 'tool_call', payload: { name: m[1], args: m[2] ?? '' } });
      return;
    }
    // Otherwise: accumulate as text and flush periodically.
    textBuf += line;
  }

  const flushInterval = setInterval(flushText, TEXT_FLUSH_INTERVAL_MS);

  child.on('error', (err) => {
    push({ type: 'error', payload: { message: `failed to spawn copilot: ${err.message}` } });
    done = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  });

  child.on('close', (code) => {
    if (lineBuf) { processLine(lineBuf); lineBuf = ''; }
    flushText();
    clearInterval(flushInterval);
    if (code !== 0 && code !== null) {
      const msg = stderr.trim() || `copilot exited with code ${code}`;
      push({ type: 'error', payload: { message: msg.slice(0, 2000) } });
    }
    push({
      type: 'done',
      payload: {
        totals: {
          tools: toolCount,
          inputTokens: 0,   // copilot CLI does not report token usage
          outputTokens: 0,
          latencyMs: Date.now() - t0,
        },
      },
    });
    done = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  });

  while (true) {
    if (queue.length) { yield queue.shift()!; continue; }
    if (done) return;
    await new Promise<void>((r) => { resolveNext = r; });
  }
}

export const copilotCliRunner: Runner = {
  id: 'copilot_cli',
  run(opts) { return runCopilot(opts); },
};
