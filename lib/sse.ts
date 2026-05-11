import type { RunnerEvent } from '@/backend/runners/base';

export type StreamHandlers = {
  onEvent: (e: RunnerEvent) => void;
  onError: (msg: string) => void;
  onDone: () => void;
};

export async function streamPost(
  url: string,
  body: unknown,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    handlers.onError((err as Error).message);
    handlers.onDone();
    return;
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    handlers.onError(msg);
    handlers.onDone();
    return;
  }

  if (!res.body) {
    handlers.onError('empty response body');
    handlers.onDone();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const line = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const json = line.slice(5).trim();
        if (!json) continue;
        try {
          const evt = JSON.parse(json) as RunnerEvent;
          handlers.onEvent(evt);
        } catch {}
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') handlers.onError((err as Error).message);
  } finally {
    handlers.onDone();
  }
}
