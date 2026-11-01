import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { researchAttemptsCsv } from '../src/research/utils/exportResearch.ts';

export async function fetchResearchResults(base, secret, fetcher = fetch, includeTest = false) {
  const results = [];
  for (let offset = 0; ; offset += 500) {
    const url = new URL('/rest/v1/research_results', base);
    url.search = new URLSearchParams({
      select: 'participant_id,sequence_id,revision,data,created_at,updated_at',
      order: 'participant_id.asc', limit: '500', offset: String(offset),
    }).toString();
    if (!includeTest) url.searchParams.set('data->>collection_environment', 'eq.production');
    const response = await fetcher(url, {
      headers: { apikey: secret, ...(secret.startsWith('eyJ') ? { Authorization: `Bearer ${secret}` } : {}) },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Supabase export failed: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Invalid Supabase response');
    results.push(...page);
    if (page.length < 500) return results;
  }
}

async function main() {
  const base = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!base || !secret) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.');
  const participants = await fetchResearchResults(base, secret, fetch, process.argv.includes('--include-test'));
  const output = path.resolve('exports');
  await mkdir(output, { recursive: true });
  const prefix = path.join(output, `research-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
  await writeFile(prefix + '.json', JSON.stringify({ exported_at: new Date().toISOString(), participants }, null, 2), { flag: 'wx' });
  await writeFile(prefix + '.csv', '\uFEFF' + researchAttemptsCsv(participants.flatMap((row) => row.data.attempts)), { flag: 'wx' });
  console.log(`Exported ${participants.length} participants to ${prefix}.{json,csv}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
