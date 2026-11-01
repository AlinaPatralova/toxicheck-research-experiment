import { createHash } from 'node:crypto';
import { validateResearchUpload } from '../server/researchValidation.js';

const maxBytes = 2 * 1024 * 1024;

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin !== (process.env.RESEARCH_ALLOWED_ORIGIN || new URL(request.url).origin)) {
    return reply(403, { error: 'Origin not allowed' });
  }
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return reply(401, { error: 'Write token required' });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return reply(415, { error: 'JSON required' });
  }
  if (Number(request.headers.get('content-length')) > maxBytes) return reply(413, { error: 'Payload too large' });
  let value: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > maxBytes) return reply(413, { error: 'Payload too large' });
    value = JSON.parse(text);
  } catch { return reply(400, { error: 'Invalid JSON' }); }
  const upload = validateResearchUpload(value);
  if (!upload) return reply(400, { error: 'Invalid research data' });
  const base = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!base || !secret || !base.startsWith('https://')) {
    return reply(503, { error: 'Research storage is not configured' });
  }
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/rest/v1/rpc/save_research_result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', apikey: secret,
        ...(secret.startsWith('eyJ') ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({
        p_participant_id: upload.payload.participant_id,
        p_sequence_id: upload.payload.sequence_id,
        p_revision: upload.revision,
        p_write_token_hash: createHash('sha256').update(token).digest('hex'),
        p_data: {
          ...upload.payload,
          collection_environment: process.env.VERCEL_ENV === 'production' ? 'production' : 'test',
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (code === '42501') return reply(403, { error: 'Invalid write token' });
      if (code === '22023') return reply(409, { error: 'Conflicting participant data' });
      console.error('Research database rejected upload', { status: response.status });
      return reply(502, { error: 'Research storage unavailable' });
    }
    const result = await response.json();
    const revision = result && typeof result === 'object' && 'revision' in result ? result.revision : null;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < upload.revision) {
      return reply(502, { error: 'Invalid storage acknowledgement' });
    }
    return reply(200, { participant_id: upload.payload.participant_id, revision });
  } catch {
    console.error('Research storage request failed');
    return reply(503, { error: 'Research storage unavailable' });
  }
}

export function GET(): Response { return reply(405, { error: 'Reading results is not permitted' }); }
