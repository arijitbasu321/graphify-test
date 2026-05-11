import { stat } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const p = searchParams.get('path')?.trim() ?? '';
  if (!p) return Response.json({ exists: false, isDir: false, hasGraphify: false, error: null });
  if (!path.isAbsolute(p)) {
    return Response.json({ exists: false, isDir: false, hasGraphify: false, error: 'must be absolute path' });
  }
  let exists = false;
  let isDir = false;
  try {
    const s = await stat(p);
    exists = true;
    isDir = s.isDirectory();
  } catch {
    return Response.json({ exists: false, isDir: false, hasGraphify: false, error: null });
  }
  let hasGraphify = false;
  try {
    const gs = await stat(path.join(p, 'graphify-out', 'GRAPH_REPORT.md'));
    hasGraphify = gs.isFile();
  } catch { hasGraphify = false; }
  return Response.json({ exists, isDir, hasGraphify, error: null });
}
