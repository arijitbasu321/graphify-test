import { buildStream, parseBody, validateRepoPath } from '@/backend/api/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const parsed = await parseBody(req);
  if ('error' in parsed) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const err = await validateRepoPath(parsed.repoPath, 'graph');
  if (err) return Response.json({ error: err }, { status: 400 });
  return buildStream(parsed.prompt, parsed.repoPath, 'graph', parsed.runner);
}
