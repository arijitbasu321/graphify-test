import { spawn } from 'node:child_process';
import type { Runner, RunnerEvent, RunOptions } from './base';

/**
 * Spawns `claude -p "<prompt>" --output-format stream-json --verbose --model sonnet --dangerously-skip-permissions`
 * Parses NDJSON. Each line is a JSON event with a `type` field:
 *   - system: setup metadata
 *   - assistant: a message with content blocks (text or tool_use)
 *   - user: tool results (we ignore content; only counted indirectly)
 *   - result: final wrap-up with usage info
 */
async function* runClaude(opts: RunOptions): AsyncGenerator<RunnerEvent> {
  const t0 = Date.now();
  const args = [
    '-p',
    opts.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    'sonnet',
    '--dangerously-skip-permissions',
  ];

  const child = spawn('claude', args, {
    cwd: opts.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (opts.signal) {
    const onAbort = () => {
      try { child.kill('SIGTERM'); } catch {}
    };
    if (opts.signal.aborted) onAbort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  // Buffer NDJSON lines as they arrive on stdout
  const queue: RunnerEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;
  let stderr = '';

  const push = (e: RunnerEvent) => {
    queue.push(e);
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  };

  let toolCount = 0;
  let lastInput = 0;
  let lastOutput = 0;

  let stdoutBuf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk;
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let evt: any;
      try { evt = JSON.parse(line); } catch { continue; }
      handleEvent(evt);
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  child.on('error', (err) => {
    push({ type: 'error', payload: { message: `failed to spawn claude: ${err.message}` } });
    done = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  });

  child.on('close', (code) => {
    // flush any trailing stdout
    if (stdoutBuf.trim()) {
      try { handleEvent(JSON.parse(stdoutBuf.trim())); } catch {}
      stdoutBuf = '';
    }
    if (code !== 0 && code !== null) {
      const msg = stderr.trim() || `claude exited with code ${code}`;
      push({ type: 'error', payload: { message: msg.slice(0, 2000) } });
    }
    push({
      type: 'done',
      payload: {
        totals: {
          tools: toolCount,
          inputTokens: lastInput,
          outputTokens: lastOutput,
          latencyMs: Date.now() - t0,
        },
      },
    });
    done = true;
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
  });

  function handleEvent(evt: any) {
    if (!evt || typeof evt !== 'object') return;

    // assistant messages: content blocks of type 'text' or 'tool_use'
    if (evt.type === 'assistant' && evt.message?.content) {
      for (const block of evt.message.content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.length) {
          push({ type: 'text', payload: { delta: block.text } });
        } else if (block.type === 'tool_use') {
          toolCount++;
          push({
            type: 'tool_call',
            payload: { name: String(block.name ?? 'tool'), args: block.input ?? {} },
          });
        }
      }
      // mid-run usage if reported
      const usage = evt.message?.usage;
      if (usage && (usage.input_tokens != null || usage.output_tokens != null)) {
        lastInput = Number(usage.input_tokens ?? lastInput) || lastInput;
        lastOutput = Number(usage.output_tokens ?? lastOutput) || lastOutput;
      }
    }

    // result event: final usage
    if (evt.type === 'result') {
      const usage = evt.usage ?? evt.message?.usage;
      if (usage) {
        const inp = Number(usage.input_tokens ?? 0)
          + Number(usage.cache_read_input_tokens ?? 0)
          + Number(usage.cache_creation_input_tokens ?? 0);
        const out = Number(usage.output_tokens ?? 0);
        if (inp) lastInput = inp;
        if (out) lastOutput = out;
        push({ type: 'token_usage', payload: { input: lastInput, output: lastOutput } });
      }
      if (evt.is_error || evt.subtype === 'error') {
        push({ type: 'error', payload: { message: String(evt.error ?? 'claude reported an error') } });
      }
    }
  }

  while (true) {
    if (queue.length) {
      yield queue.shift()!;
      continue;
    }
    if (done) return;
    await new Promise<void>((r) => { resolveNext = r; });
  }
}

export const claudeCodeRunner: Runner = {
  id: 'claude_code',
  run(opts) { return runClaude(opts); },
};
