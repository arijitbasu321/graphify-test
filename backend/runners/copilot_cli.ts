import type { Runner, RunnerEvent } from './base';

async function* notImplemented(): AsyncGenerator<RunnerEvent> {
  yield {
    type: 'error',
    payload: { message: 'copilot_cli runner not yet implemented' },
  };
  yield {
    type: 'done',
    payload: { totals: { tools: 0, inputTokens: 0, outputTokens: 0, latencyMs: 0 } },
  };
}

export const copilotCliRunner: Runner = {
  id: 'copilot_cli',
  run() {
    return notImplemented();
  },
};
