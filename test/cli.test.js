import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(...args) { return spawnSync(process.execPath, ['bin/qa-signal.js', ...args], { cwd: root, encoding: 'utf8' }); }
test('CLI exports real files and applies gate after export', t => {
  const temp = mkdtempSync(join(tmpdir(), 'qa-signal-')); t.after(() => rmSync(temp, { recursive: true, force: true }));
  const r = run('examples/current.json', '--baseline', 'examples/baseline.json', '--out', temp, '--fail-on', 'new');
  assert.equal(r.status, 1, r.stderr); assert.ok(existsSync(join(temp, 'index.html'))); assert.ok(existsSync(join(temp, 'bug-drafts.md')));
  const report = JSON.parse(readFileSync(join(temp, 'report.json'))); assert.equal(report.total, 9); assert.equal(report.changes.regression, 2); assert.equal(report.changes.recovered, 1); assert.equal(report.notObserved.length, 1);
  const retry = run('examples/current.json', '--out', temp); assert.equal(retry.status, 2); assert.match(retry.stderr, /already exists/);
  assert.equal(run('examples/current.json', '--out', temp, '--force').status, 0);
});
test('CLI rejects malformed JSON, unknown switches, and incomplete arguments', t => {
  const temp = mkdtempSync(join(tmpdir(), 'qa-signal-')); t.after(() => rmSync(temp, { recursive: true, force: true }));
  const file = join(temp, 'bad.json'); writeFileSync(file, '{invalid');
  for (const args of [[file], ['--wat'], ['--out'], ['examples/current.json', '--fail-on', 'bad'], ['examples/current.json', '--fail-on', 'new']]) assert.equal(run(...args).status, 2);
});
test('CLI accepts UTF-8 BOM and does not overwrite input', t => {
  const temp = mkdtempSync(join(tmpdir(), 'qa-signal-')); t.after(() => rmSync(temp, { recursive: true, force: true }));
  const file = join(temp, 'report.json'); writeFileSync(file, '\uFEFF' + readFileSync(join(root, 'examples/current.json'), 'utf8'));
  assert.equal(run(file, '--out', join(temp, 'output')).status, 0);
  const r = run(file, '--out', temp, '--force'); assert.equal(r.status, 2); assert.match(r.stderr, /overwrite an input/);
});
