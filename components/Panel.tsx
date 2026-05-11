'use client';

import { Markdown } from './Markdown';
import { ToolLog } from './ToolLog';
import { CountUp } from './CountUp';
import { formatLatency } from '@/lib/format';
import type { PanelState, PanelVariant } from '@/lib/state';

type Props = {
  variant: PanelVariant;
  state: PanelState;
  runnerId: string;
};

export function Panel({ variant, state, runnerId }: Props) {
  const isGraph = variant === 'graph';
  const tokens = state.inputTokens + state.outputTokens;

  let statusLabel: string;
  if (state.status === 'idle') statusLabel = 'idle';
  else if (state.status === 'running') statusLabel = 'streaming';
  else if (state.status === 'error') statusLabel = 'error';
  else statusLabel = 'done';

  // Gold accent ONLY on the graph side. Naive is fully monochrome.
  const labelColor = isGraph ? 'text-gold' : 'text-tprimary';
  const tokenColor = isGraph ? 'text-gold' : 'text-tprimary';

  return (
    <section className="bg-s1 border border-bdefault rounded flex flex-col min-h-0">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`text-15 font-semibold tracking-tight ${labelColor}`}>
            {isGraph ? 'Graph' : 'Naive'}
          </span>
          <span className="text-12 text-ttertiary">
            {isGraph ? 'graphify-out/ available' : 'no graphify-out/'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-12 text-ttertiary">{statusLabel}</span>
          <span className="text-12 mono text-tsecondary border border-bsubtle rounded-sm px-1">
            {runnerId}
          </span>
        </div>
      </header>

      <div className="border-t border-bsubtle" />

      <div className="px-4 py-4 flex-1 min-h-[260px] overflow-y-auto">
        {state.error ? (
          <div className="text-14 text-danger">{state.error}</div>
        ) : state.text ? (
          <Markdown>{state.text}</Markdown>
        ) : (
          <div className="text-14 text-ttertiary">—</div>
        )}
      </div>

      <ToolLog items={state.toolCalls} />

      <footer className="grid grid-cols-3 border-t border-bsubtle">
        <Stat
          label="tool calls"
          value={<CountUp value={state.toolCalls.length} className="mono tnum text-18 font-semibold text-tprimary" />}
        />
        <Stat
          label="tokens"
          value={
            tokens === 0
              ? <span className="mono text-18 font-semibold text-ttertiary">—</span>
              : <CountUp value={tokens} className={`mono tnum text-18 font-semibold ${tokenColor}`} />
          }
        />
        <Stat
          label="latency"
          value={
            <span className="mono tnum text-18 font-semibold text-tprimary">
              {state.latencyMs > 0 ? formatLatency(state.latencyMs) : '—'}
            </span>
          }
        />
      </footer>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-r border-bsubtle last:border-r-0">
      <div className="text-12 text-ttertiary mb-2 uppercase tracking-wider">{label}</div>
      <div>{value}</div>
    </div>
  );
}
