#!/usr/bin/env node
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { analyze, shouldFail } from '../src/analyze.js';
import { renderHtml, renderMarkdown, renderBugDrafts } from '../src/render.js';

const usage = `QA Signal 0.1.0 — local Playwright failure triage

Usage: node bin/qa-signal.js <results.json> [options]
  --baseline <file>       Compare against a prior Playwright JSON report
  --out <directory>       Output folder (default: qa-signal-report)
  --label <text>          Human-readable run name
  --fail-on <policy>      none (default), failures, unstable, or new
  --force                Replace existing generated output files
  --help                 Show this help

Outputs: index.html, summary.md, bug-drafts.md, report.json
Exit codes: 0 generated, 1 policy failed (reports still written), 2 input/output error.
No network requests. No tests are executed. No issues are posted.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { console.log(usage); return; }
  const opts = { out: 'qa-signal-report', 'fail-on': 'none' };
  let input;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--force') { opts.force = true; continue; }
    if (['--baseline', '--out', '--label', '--fail-on'].includes(arg)) {
      const next = args[++i];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      opts[arg.slice(2)] = next;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (input) throw new Error('Only one current report is accepted. Merge Playwright shards before analysis.');
    else input = arg;
  }
  if (!input) throw new Error('Provide a Playwright JSON report. Use --help for usage.');
  if (!['none', 'failures', 'unstable', 'new'].includes(opts['fail-on'])) throw new Error('Invalid --fail-on policy.');
  if (opts['fail-on'] === 'new' && !opts.baseline) throw new Error('--fail-on new requires --baseline.');
  async function read(file) {
    try { return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
    catch (e) { throw new Error(`Cannot read JSON from ${file}: ${e.message}`); }
  }
  const current = await read(input);
  const baseline = opts.baseline ? await read(opts.baseline) : null;
  const report = analyze(current, baseline, { label: opts.label || path.basename(input) });
  const outputs = {
    'index.html': renderHtml(report), 'summary.md': renderMarkdown(report),
    'bug-drafts.md': renderBugDrafts(report), 'report.json': JSON.stringify(report, null, 2) + '\n',
  };
  const out = path.resolve(opts.out);
  const sources = [input, opts.baseline].filter(Boolean).map(f => path.resolve(f));
  for (const name of Object.keys(outputs)) {
    const dest = path.join(out, name);
    if (sources.includes(dest)) throw new Error('Output would overwrite an input report. Choose a different --out directory.');
    if (!opts.force) {
      try { await access(dest); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
      throw new Error(`${dest} already exists. Choose another --out directory or use --force.`);
    }
  }
  await mkdir(out, { recursive: true });
  for (const [name, content] of Object.entries(outputs)) await writeFile(path.join(out, name), content, { flag: opts.force ? 'w' : 'wx' });
  console.log(`${report.verdict} | ${report.total} logical tests | ${report.counts.failed} failed | ${report.counts.flaky} flaky | ${report.changes.regression} regressions`);
  console.log(`Report: ${path.join(out, 'index.html')}`);
  console.log('Review generated reports before sharing. Triage suggestions are hypotheses.');
  if (shouldFail(report, opts['fail-on'])) process.exitCode = 1;
}
main().catch(error => { console.error(`QA Signal: ${error.message}`); process.exitCode = 2; });
