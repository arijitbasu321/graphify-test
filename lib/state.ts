import type { ToolCallPayload } from '@/backend/runners/base';

export type PanelVariant = 'naive' | 'graph';
export type PanelStatus = 'idle' | 'running' | 'done' | 'error';

export type PanelState = {
  status: PanelStatus;
  text: string;
  toolCalls: ToolCallPayload[];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
};

export const initialPanel: PanelState = {
  status: 'idle',
  text: '',
  toolCalls: [],
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: 0,
};

export type Aggregate = {
  naiveTotal: number;
  graphTotal: number;
  queries: number;
};

export const initialAggregate: Aggregate = {
  naiveTotal: 0,
  graphTotal: 0,
  queries: 0,
};
