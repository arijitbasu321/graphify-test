import type { Runner } from './base';
import { mockRunner } from './mock';
import { claudeCodeRunner } from './claude_code';
import { copilotCliRunner } from './copilot_cli';

export type RunnerId = 'mock' | 'claude_code' | 'copilot_cli';

export const RUNNER_IDS: RunnerId[] = ['mock', 'claude_code', 'copilot_cli'];

const REGISTRY: Record<RunnerId, Runner> = {
  mock: mockRunner,
  claude_code: claudeCodeRunner,
  copilot_cli: copilotCliRunner,
};

function isRunnerId(v: string): v is RunnerId {
  return v === 'mock' || v === 'claude_code' || v === 'copilot_cli';
}

export function getDefaultRunnerId(): RunnerId {
  const v = (process.env.RUNNER ?? 'mock').toLowerCase();
  return isRunnerId(v) ? v : 'mock';
}

export function getRunner(id: string | undefined | null): Runner {
  if (id && isRunnerId(id)) return REGISTRY[id];
  return REGISTRY[getDefaultRunnerId()];
}

// Back-compat (kept while components migrate):
export const getActiveRunnerId = getDefaultRunnerId;
export function getActiveRunner(): Runner { return REGISTRY[getDefaultRunnerId()]; }
