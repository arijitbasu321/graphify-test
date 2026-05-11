'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { Panel } from '@/components/Panel';
import { AggregateStrip } from '@/components/AggregateStrip';
import type { RunnerStatus } from '@/components/RunnerSelect';
import { initialAggregate, initialPanel, type Aggregate, type PanelState, type PanelVariant } from '@/lib/state';
import { streamPost } from '@/lib/sse';
import type { RunnerEvent } from '@/backend/runners/base';

type RunnerInfo = { defaultRunner: string; runners: RunnerStatus[] };

export default function Page() {
  const [naivePath, setNaivePath] = useState('');
  const [graphPath, setGraphPath] = useState('');
  const [prompt, setPrompt] = useState('');
  const [naive, setNaive] = useState<PanelState>(initialPanel);
  const [graph, setGraph] = useState<PanelState>(initialPanel);
  const [aggregate, setAggregate] = useState<Aggregate>(initialAggregate);
  const [runnerInfo, setRunnerInfo] = useState<RunnerInfo>({ defaultRunner: 'mock', runners: [] });
  const [selectedRunner, setSelectedRunner] = useState<string>('mock');
  const initializedRunnerRef = useRef(false);

  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef<{ naive: boolean; graph: boolean }>({ naive: false, graph: false });

  useEffect(() => {
    fetch('/api/runner-info')
      .then((r) => r.json())
      .then((info: RunnerInfo) => {
        setRunnerInfo(info);
        if (!initializedRunnerRef.current) {
          // pick the default if available, else first available, else mock
          const def = info.runners.find((r) => r.id === info.defaultRunner && r.available);
          const firstAvail = info.runners.find((r) => r.available);
          setSelectedRunner((def ?? firstAvail ?? { id: 'mock' }).id);
          initializedRunnerRef.current = true;
        }
      })
      .catch(() => {});
  }, []);

  const handleEvent = useCallback((variant: PanelVariant, evt: RunnerEvent) => {
    const setter = variant === 'naive' ? setNaive : setGraph;
    setter((s) => {
      switch (evt.type) {
        case 'text':
          return { ...s, text: s.text + evt.payload.delta };
        case 'tool_call':
          return { ...s, toolCalls: [...s.toolCalls, evt.payload] };
        case 'token_usage':
          return { ...s, inputTokens: evt.payload.input, outputTokens: evt.payload.output };
        case 'error':
          return { ...s, status: 'error', error: evt.payload.message };
        case 'done':
          return {
            ...s,
            status: s.status === 'error' ? 'error' : 'done',
            inputTokens: evt.payload.totals.inputTokens || s.inputTokens,
            outputTokens: evt.payload.totals.outputTokens || s.outputTokens,
            latencyMs: evt.payload.totals.latencyMs,
          };
        default:
          return s;
      }
    });
  }, []);

  const onRun = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setNaive({ ...initialPanel, status: 'running' });
    setGraph({ ...initialPanel, status: 'running' });
    runningRef.current = { naive: true, graph: true };

    const finishedTotals: { naive?: number; graph?: number } = {};

    const finalize = (variant: PanelVariant, total: number) => {
      finishedTotals[variant] = total;
      runningRef.current[variant] = false;
      if (!runningRef.current.naive && !runningRef.current.graph) {
        const n = finishedTotals.naive ?? 0;
        const g = finishedTotals.graph ?? 0;
        if (n > 0 || g > 0) {
          setAggregate((a) => ({
            naiveTotal: a.naiveTotal + n,
            graphTotal: a.graphTotal + g,
            queries: a.queries + 1,
          }));
        }
      }
    };

    const runOne = (variant: PanelVariant) => {
      const url = variant === 'naive' ? '/api/naive' : '/api/graph';
      const repoPath = variant === 'naive' ? naivePath.trim() : graphPath.trim();
      let lastTokens = 0;
      streamPost(
        url,
        { repoPath, prompt: prompt.trim(), runner: selectedRunner },
        {
          onEvent: (evt) => {
            handleEvent(variant, evt);
            if (evt.type === 'token_usage') lastTokens = evt.payload.input + evt.payload.output;
            if (evt.type === 'done') {
              const t = evt.payload.totals.inputTokens + evt.payload.totals.outputTokens;
              if (t > 0) lastTokens = t;
            }
          },
          onError: (msg) => handleEvent(variant, { type: 'error', payload: { message: msg } }),
          onDone: () => finalize(variant, lastTokens),
        },
        ac.signal,
      );
    };

    runOne('naive');
    runOne('graph');
  }, [naivePath, graphPath, prompt, selectedRunner, handleEvent]);

  const running = naive.status === 'running' || graph.status === 'running';

  const onChange = useCallback((next: { naivePath?: string; graphPath?: string; prompt?: string }) => {
    if (next.naivePath !== undefined) setNaivePath(next.naivePath);
    if (next.graphPath !== undefined) setGraphPath(next.graphPath);
    if (next.prompt !== undefined) setPrompt(next.prompt);
  }, []);

  const onReset = useCallback(() => {
    abortRef.current?.abort();
    setNaive(initialPanel);
    setGraph(initialPanel);
    setAggregate(initialAggregate);
  }, []);

  // Surface a banner if the selected runner reports unavailable
  const sel = runnerInfo.runners.find((r) => r.id === selectedRunner);
  const runnerError =
    sel && !sel.available
      ? `${selectedRunner} not available — ${sel.error ?? 'not installed'}`
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        naivePath={naivePath}
        graphPath={graphPath}
        prompt={prompt}
        running={running}
        runners={runnerInfo.runners}
        selectedRunner={selectedRunner}
        onSelectRunner={setSelectedRunner}
        runnerError={runnerError}
        onChange={onChange}
        onRun={onRun}
      />
      <main className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0">
        <Panel variant="naive" state={naive} runnerId={selectedRunner} />
        <Panel variant="graph" state={graph} runnerId={selectedRunner} />
      </main>
      <AggregateStrip aggregate={aggregate} onReset={onReset} />
    </div>
  );
}
