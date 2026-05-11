'use client';

export type RunnerStatus = { id: string; available: boolean; version?: string; error?: string };

type Props = {
  runners: RunnerStatus[];
  selected: string;
  onChange: (id: string) => void;
};

const LABEL: Record<string, string> = {
  mock: 'mock',
  claude_code: 'claude_code',
  copilot_cli: 'copilot_cli',
};

export function RunnerSelect({ runners, selected, onChange }: Props) {
  if (!runners.length) return null;
  const sel = runners.find((r) => r.id === selected);
  const title = sel?.available ? sel.version ?? sel.id : sel ? `unavailable: ${sel.error ?? 'not found'}` : '';

  return (
    <div className="relative inline-flex items-center">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        title={title}
        className="mono text-13 bg-s1 text-tprimary border border-bdefault rounded px-2 py-1 pr-7 appearance-none cursor-pointer hover:bg-s2 transition-colors duration-120 focus:border-tsecondary"
      >
        {runners.map((r) => (
          <option key={r.id} value={r.id} disabled={!r.available}>
            {(LABEL[r.id] ?? r.id) + (r.available ? '' : ' (unavailable)')}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 mono text-12 text-ttertiary"
      >
        ▾
      </span>
    </div>
  );
}
