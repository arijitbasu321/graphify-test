export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
}

export function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  return `${pct.toFixed(1)}%`;
}

export function summarizeArgs(args: unknown): string {
  if (args == null) return '';
  if (typeof args === 'string') return truncate(args, 80);
  if (typeof args !== 'object') return String(args);
  const o = args as Record<string, unknown>;
  // common shapes: { pattern }, { file_path }, { command }, { path }
  const candidates = ['pattern', 'file_path', 'file', 'path', 'command', 'cmd', 'query', 'url'];
  for (const k of candidates) {
    if (k in o && typeof o[k] === 'string') return truncate(o[k] as string, 80);
  }
  // fallback: first string value
  for (const v of Object.values(o)) {
    if (typeof v === 'string') return truncate(v, 80);
  }
  return truncate(JSON.stringify(o), 80);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
