import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, encoding: 'utf8'
}).split('\0').filter(Boolean))];
const patterns = [
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['API token', /\bsk-[A-Za-z0-9_-]{24,}/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['Database connection', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s"']+/i],
  ['Embedded URL credentials', /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ['Assigned credential', /(?:password|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_+/=-]{16,}["']/i],
  ['Registry auth', /(?:_authToken|_auth)\s*=/]
];
let failures = 0;
for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  const leaf = path.posix.basename(normalized);
  if ((/^\.env(?:rc|\.|$)/.test(leaf) && leaf !== '.env.example') ||
      /(?:^|\/)(?:\.vercel|\.netlify|\.aws|\.ssh|secrets|research-data|raw-data|exports|results|outputs)\//.test(normalized) ||
      /\.(?:pem|key|p12|pfx|har)$/i.test(leaf) ||
      /^(?:\.npmrc|\.yarnrc(?:\.yml)?|\.netrc|.*credentials.*\.json|.*service[-_]account.*\.json|toxicheck-research-.*\.(?:json|csv))$/i.test(leaf)) {
    console.error(`${file}: sensitive/local file must not be published`);
    failures += 1;
    continue;
  }
  const bytes = await readFile(path.join(root, file));
  if (bytes.includes(0)) continue;
  for (const [index, line] of bytes.toString('utf8').split(/\r?\n/).entries()) {
    for (const [name, pattern] of patterns) {
      if (!pattern.test(line)) continue;
      console.error(`${file}:${index + 1}: potential ${name} (value redacted)`);
      failures += 1;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log(`Secret/file hygiene check passed for ${files.length} publishable files. Pattern-based check; manual review is still required.`);
