import { spawn } from 'node:child_process';
import { getActiveRunnerId } from '@/backend/runners';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function checkClaude(): Promise<{ available: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => resolve({ available: false, error: e.message }));
    child.on('close', (code) => {
      if (code === 0) resolve({ available: true, version: out.trim() });
      else resolve({ available: false, error: err.trim() || `exit ${code}` });
    });
  });
}

export async function GET() {
  const runner = getActiveRunnerId();
  let claude: { available: boolean; version?: string; error?: string } = { available: true };
  if (runner === 'claude_code') claude = await checkClaude();
  return Response.json({ runner, claude });
}
