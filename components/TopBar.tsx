'use client';

import { useEffect, useRef, useState } from 'react';

type DetectResult = { exists: boolean; isDir: boolean; hasGraphify: boolean; error: string | null };

type Props = {
  naivePath: string;
  graphPath: string;
  prompt: string;
  running: boolean;
  runnerId: string;
  claudeError?: string | null;
  onChange: (next: { naivePath?: string; graphPath?: string; prompt?: string }) => void;
  onRun: () => void;
};

const EMPTY_DETECT: DetectResult = { exists: false, isDir: false, hasGraphify: false, error: null };

function useDetect(p: string): DetectResult {
  const [result, setResult] = useState<DetectResult>(EMPTY_DETECT);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!p) { setResult(EMPTY_DETECT); return; }
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/detect?path=${encodeURIComponent(p)}`);
        const j = (await res.json()) as DetectResult;
        setResult(j);
      } catch {
        setResult({ exists: false, isDir: false, hasGraphify: false, error: 'detect failed' });
      }
    }, 250);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [p]);
  return result;
}

export function TopBar(props: Props) {
  const { naivePath, graphPath, prompt, running, runnerId, claudeError, onChange, onRun } = props;
  const naiveDetect = useDetect(naivePath);
  const graphDetect = useDetect(graphPath);

  const canRun = !running && naivePath.trim() && graphPath.trim() && prompt.trim();

  return (
    <header className="border-b border-bdefault bg-s1">
      {claudeError && (
        <div className="px-4 py-2 border-b border-bsubtle text-13 text-danger bg-bg">
          claude CLI not available — {claudeError}
        </div>
      )}
      <div className="grid grid-cols-12 gap-3 px-4 py-3 items-start">
        <div className="col-span-3">
          <label className="block text-12 text-ttertiary mb-2 uppercase tracking-wider">naive repo path</label>
          <input
            type="text"
            value={naivePath}
            onChange={(e) => onChange({ naivePath: e.target.value })}
            placeholder="/path/to/repo"
            className="w-full mono text-13"
            spellCheck={false}
          />
          <DetectLine variant="naive" path={naivePath} detect={naiveDetect} />
        </div>
        <div className="col-span-3">
          <label className="block text-12 text-ttertiary mb-2 uppercase tracking-wider">graph repo path</label>
          <input
            type="text"
            value={graphPath}
            onChange={(e) => onChange({ graphPath: e.target.value })}
            placeholder="/path/to/repo (graphified)"
            className="w-full mono text-13"
            spellCheck={false}
          />
          <DetectLine variant="graph" path={graphPath} detect={graphDetect} />
        </div>
        <div className="col-span-4">
          <label className="block text-12 text-ttertiary mb-2 uppercase tracking-wider">question</label>
          <textarea
            value={prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder="explain the auth flow"
            rows={3}
            className="w-full text-14"
          />
        </div>
        <div className="col-span-2 flex flex-col items-stretch gap-2">
          <label className="block text-12 text-ttertiary mb-2 uppercase tracking-wider">&nbsp;</label>
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun}
            className="bg-tprimary text-bg text-14 font-semibold rounded px-4 py-2 hover:bg-tsecondary disabled:bg-s2 disabled:text-ttertiary transition-colors duration-120"
          >
            {running ? 'running…' : 'run'}
          </button>
          <div className="flex items-center justify-end gap-2 text-12 text-ttertiary">
            <span>runner</span>
            <span className="mono text-tsecondary border border-bsubtle rounded-sm px-1">{runnerId}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function DetectLine({ variant, path, detect }: { variant: 'naive' | 'graph'; path: string; detect: DetectResult }) {
  if (!path.trim()) return <div className="text-12 text-ttertiary mt-2 mono">&nbsp;</div>;
  if (detect.error) return <div className="text-12 text-danger mt-2 mono">{detect.error}</div>;
  if (!detect.exists) return <div className="text-12 text-danger mt-2 mono">path not found</div>;
  if (!detect.isDir) return <div className="text-12 text-danger mt-2 mono">not a directory</div>;

  if (variant === 'naive') {
    if (detect.hasGraphify) return <div className="text-12 text-danger mt-2 mono">graphify-out/ present — use a fresh clone</div>;
    return <div className="text-12 text-tsecondary mt-2 mono">ok · no graphify-out/</div>;
  }
  if (!detect.hasGraphify) return <div className="text-12 text-danger mt-2 mono">missing graphify-out/GRAPH_REPORT.md</div>;
  return <div className="text-12 text-tsecondary mt-2 mono">ok · graphify-out/ detected</div>;
}
