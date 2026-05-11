import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { RunnerEvent, RunnerVariant } from '@/backend/runners/base';
import { getRunner, type RunnerId } from '@/backend/runners';

export type StreamRequestBody = { repoPath?: unknown; prompt?: unknown; runner?: unknown };

export async function validateRepoPath(repoPath: string, variant: RunnerVariant): Promise<string | null> {
  if (!repoPath || typeof repoPath !== 'string') return 'repoPath is required';
  if (!path.isAbsolute(repoPath)) return 'repoPath must be an absolute path';
  let s;
  try { s = await stat(repoPath); } catch { return `repoPath does not exist: ${repoPath}`; }
  if (!s.isDirectory()) return `repoPath is not a directory: ${repoPath}`;

  const graphReport = path.join(repoPath, 'graphify-out', 'GRAPH_REPORT.md');
  const graphDir = path.join(repoPath, 'graphify-out');

  if (variant === 'naive') {
    try {
      const gs = await stat(graphDir);
      if (gs.isDirectory()) {
        return 'This is the naive baseline — repo must NOT have graphify-out/. Run on a fresh clone.';
      }
    } catch { /* good — absent */ }
  } else {
    try {
      const gs = await stat(graphReport);
      if (!gs.isFile()) throw new Error('not a file');
    } catch {
      return 'Repo missing graphify-out/. Run `/graphify .` in the repo first.';
    }
  }
  return null;
}

function sseEncode(event: RunnerEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function buildStream(prompt: string, cwd: string, variant: RunnerVariant, runnerId?: RunnerId): Response {
  const runner = getRunner(runnerId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const ac = new AbortController();
      const onClose = () => ac.abort();
      // best-effort: if the response is cancelled, abort the runner
      // (Next 14 doesn't surface a cancel signal here, but if the runner respects abort it'll stop)
      try {
        for await (const evt of runner.run({ prompt, cwd, variant, signal: ac.signal })) {
          controller.enqueue(encoder.encode(sseEncode(evt)));
          if (evt.type === 'done') break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sseEncode({ type: 'error', payload: { message: msg } })));
        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: 'done',
              payload: { totals: { tools: 0, inputTokens: 0, outputTokens: 0, latencyMs: 0 } },
            }),
          ),
        );
      } finally {
        onClose();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function parseBody(req: Request): Promise<{ repoPath: string; prompt: string; runner?: RunnerId } | { error: string }> {
  let body: StreamRequestBody;
  try { body = (await req.json()) as StreamRequestBody; } catch { return { error: 'invalid JSON body' }; }
  const repoPath = typeof body.repoPath === 'string' ? body.repoPath.trim() : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!repoPath) return { error: 'repoPath is required' };
  if (!prompt) return { error: 'prompt is required' };
  let runner: RunnerId | undefined;
  if (typeof body.runner === 'string') {
    const r = body.runner.toLowerCase();
    if (r === 'mock' || r === 'claude_code' || r === 'copilot_cli') runner = r;
  }
  return { repoPath, prompt, runner };
}
