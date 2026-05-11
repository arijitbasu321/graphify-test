import type { Runner } from './base';
import { mockRunner } from './mock';
import { claudeCodeRunner } from './claude_code';
import { copilotCliRunner } from './copilot_cli';

export type RunnerId = 'mock' | 'claude_code' | 'copilot_cli';

const REGISTRY: Record<RunnerId, Runner> = {
  mock: mockRunner,
  claude_code: claudeCodeRunner,
  copilot_cli: copilotCliRunner,
};

export function getActiveRunnerId(): RunnerId {
  const v = (process.env.RUNNER ?? 'mock').toLowerCase();
  if (v === 'claude_code' || v === 'copilot_cli' || v === 'mock') return v;
  return 'mock';
}

export function getActiveRunner(): Runner {
  return REGISTRY[getActiveRunnerId()];
}
