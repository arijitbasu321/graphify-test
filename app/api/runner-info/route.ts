import { spawn } from 'node:child_process';
import { getDefaultRunnerId, RUNNER_IDS, type RunnerId } from '@/backend/runners';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CliCheck = { available: boolean; version?: string; error?: string };

function checkCli(bin: string, args: string[] = ['--version']): Promise<CliCheck> {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      resolve({ available: false, error: e.message });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) resolve({ available: true, version: (out || err).trim().split('\n')[0] });
      else resolve({ available: false, error: (err || out).trim().split('\n')[0] || `exit ${code}` });
    });
    // safety timeout
    setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      resolve({ available: false, error: 'timeout' });
    }, 4000);
  });
}

type RunnerStatus = { id: RunnerId; available: boolean; version?: string; error?: string };

export async function GET() {
  const defaultRunner = getDefaultRunnerId();

  const [claude, copilot] = await Promise.all([
    checkCli('claude', ['--version']),
    checkCli('copilot', ['--version']),
  ]);

  const runners: RunnerStatus[] = RUNNER_IDS.map((id) => {
    if (id === 'mock') return { id, available: true };
    if (id === 'claude_code') return { id, ...claude };
    return { id, ...copilot };
  });

  return Response.json({ defaultRunner, runners });
}
