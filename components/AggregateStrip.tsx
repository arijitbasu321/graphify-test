'use client';

import { CountUp } from './CountUp';
import { formatPct } from '@/lib/format';
import type { Aggregate } from '@/lib/state';

type Props = { aggregate: Aggregate; onReset: () => void };

export function AggregateStrip({ aggregate, onReset }: Props) {
  const { naiveTotal, graphTotal, queries } = aggregate;
  const saved = Math.max(0, naiveTotal - graphTotal);
  const pct = naiveTotal > 0 ? (saved / naiveTotal) * 100 : 0;
  const avg = queries > 0 ? Math.round(saved / queries) : 0;
  const hasData = queries > 0;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 border-t border-bdefault bg-s1">
      <div className="grid grid-cols-12 items-stretch">
        <Field
          className="col-span-5"
          label="tokens saved"
          value={
            hasData ? (
              <span className="flex items-baseline gap-3">
                <CountUp value={saved} className="mono tnum text-20 font-semibold text-gold" />
                <span className="mono tnum text-14 text-tsecondary">{formatPct(pct)}</span>
              </span>
            ) : (
              <span className="mono text-20 font-semibold text-ttertiary">—</span>
            )
          }
        />
        <Field
          className="col-span-3"
          label="queries"
          value={
            hasData ? (
              <CountUp value={queries} className="mono tnum text-20 font-semibold text-tprimary" />
            ) : (
              <span className="mono text-20 font-semibold text-ttertiary">—</span>
            )
          }
        />
        <Field
          className="col-span-3"
          label="avg savings / query"
          value={
            hasData ? (
              <CountUp value={avg} className="mono tnum text-20 font-semibold text-tprimary" />
            ) : (
              <span className="mono text-20 font-semibold text-ttertiary">—</span>
            )
          }
        />
        <div className="col-span-1 border-l border-bsubtle px-4 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasData}
            className="text-13 text-ttertiary hover:text-tprimary disabled:hover:text-ttertiary transition-colors duration-120"
          >
            reset
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3 border-r border-bsubtle ${className ?? ''}`}>
      <div className="text-12 text-ttertiary mb-2 uppercase tracking-wider">{label}</div>
      <div>{value}</div>
    </div>
  );
}
