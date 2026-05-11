export type ToolCallPayload = { name: string; args: unknown };
export type TextPayload = { delta: string };
export type TokenUsagePayload = { input: number; output: number };
export type ErrorPayload = { message: string };
export type DonePayload = {
  totals: {
    tools: number;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  };
};

export type RunnerEvent =
  | { type: 'tool_call'; payload: ToolCallPayload }
  | { type: 'text'; payload: TextPayload }
  | { type: 'token_usage'; payload: TokenUsagePayload }
  | { type: 'error'; payload: ErrorPayload }
  | { type: 'done'; payload: DonePayload };

export type RunnerVariant = 'naive' | 'graph';

export interface RunOptions {
  prompt: string;
  cwd: string;
  variant: RunnerVariant;
  signal?: AbortSignal;
}

export interface Runner {
  readonly id: 'mock' | 'claude_code' | 'copilot_cli';
  run(options: RunOptions): AsyncIterable<RunnerEvent>;
}
