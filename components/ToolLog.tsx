'use client';

import { useState } from 'react';
import { summarizeArgs } from '@/lib/format';
import type { ToolCallPayload } from '@/backend/runners/base';

type Props = { items: ToolCallPayload[] };

export function ToolLog({ items }: Props) {
  const [open, setOpen] = useState(false);
  const count = items.length;
  return (
    <div className="border-t border-bsubtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-13 text-tsecondary hover:bg-s2 transition-colors duration-120"
      >
        <span className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-12 text-ttertiary">tool calls</span>
          <span className="mono tnum text-14 font-semibold text-tprimary">{count}</span>
        </span>
        <span aria-hidden className="mono text-ttertiary">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="border-t border-bsubtle px-4 py-3 max-h-48 overflow-y-auto mono text-13 text-tsecondary space-y-1">
          {count === 0 && <li className="text-ttertiary">—</li>}
          {items.map((item, i) => (
            <li key={i} className="truncate">
              <span className="text-tprimary font-semibold">{item.name}</span>
              <span className="text-ttertiary">(</span>
              <span>{summarizeArgs(item.args)}</span>
              <span className="text-ttertiary">)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
