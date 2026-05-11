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
  return (
    <div className="flex items-center gap-1">
      {runners.map((r) => {
        const isSel = r.id === selected;
        const disabled = !r.available;
        const title = r.available
          ? r.version || r.id
          : `unavailable: ${r.error ?? 'not found'}`;
        return (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r.id)}
            title={title}
            className={[
              'mono text-12 px-2 py-1 rounded-sm border transition-colors duration-120',
              isSel
                ? 'border-tprimary text-tprimary bg-s2'
                : 'border-bsubtle text-tsecondary hover:bg-s2',
              disabled ? 'opacity-50 cursor-not-allowed line-through' : '',
            ].join(' ')}
          >
            {LABEL[r.id] ?? r.id}
          </button>
        );
      })}
    </div>
  );
}
