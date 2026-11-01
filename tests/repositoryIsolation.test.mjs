import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

test('Git ignores credentials, deployment links, generated files, and participant exports', () => {
  const files = ['.env', '.env.production', '.npmrc', '.vercel/project.json', 'node_modules/example.js',
    'dist/index.html', 'exports/session.json', 'research-data/attempts.csv', 'toxicheck-research-2026-10-15.json'];
  const ignored = execFileSync('git', ['check-ignore', '--no-index', ...files], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8'
  }).trim().split(/\r?\n/);
  assert.deepEqual(ignored, files);
});

test('hosting serves research Functions separately from the SPA and has no product API proxy', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.outputDirectory, 'dist');
  assert.deepEqual(config.rewrites, [{ source: '/((?!api(?:/|$)).*)', destination: '/index.html' }]);
  const spa = new RegExp('^' + config.rewrites[0].source + '$');
  for (const route of ['/', '/research', '/research/flat']) assert.equal(spa.test(route), true);
  for (const route of ['/api', '/api/research', '/api/unknown']) assert.equal(spa.test(route), false);
});

test('direct dependencies and the Vue package family use exact reproducible versions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const version of Object.values({ ...manifest.dependencies, ...manifest.devDependencies })) {
    assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  }
  assert.ok(Object.values(manifest.overrides).every((version) => version === manifest.dependencies.vue));
});

test('Vercel Functions have root compiler options because project references are not used by the runtime builder', async () => {
  const config = JSON.parse(await readFile(new URL('../tsconfig.json', import.meta.url), 'utf8'));
  assert.equal(config.compilerOptions.module, 'NodeNext');
  assert.equal(config.compilerOptions.moduleResolution, 'NodeNext');
  assert.ok(config.compilerOptions.types.includes('node'));
});

test('active entry points import only the research application and shared shell', async () => {
  const allowed = {
    'src/main.ts': ['vue', './App.vue', './style.css', './researchRouter'],
    'src/researchRouter.ts': ['vue-router', './research/views/ResearchRootView.vue']
  };
  for (const [file, expected] of Object.entries(allowed)) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const imports = ast.statements.filter(ts.isImportDeclaration).map((node) => node.moduleSpecifier.text);
    assert.deepEqual(imports, expected);
  }
});
