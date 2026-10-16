import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classify, redact, shouldFail } from '../src/analyze.js';
import { renderHtml, renderMarkdown, renderBugDrafts } from '../src/render.js';

function report({ status = 'expected', results = [{ status: 'passed', duration: 10 }], expectedStatus = 'passed', title = 'works', project = 'chromium', line = 10, errors = [] } = {}) {
  return { suites: [{ title: 'a.spec.js', file: 'a.spec.js', specs: [{ title, file: 'a.spec.js', line, tests: [{ status, results, expectedStatus, projectName: project }] }] }], errors };
}
const failure = () => report({ status: 'unexpected', results: [{ status: 'failed', errors: [{ message: 'Expected: 200\nReceived: 500' }] }] });

test('pass is clear and cannot establish a regression without a baseline', () => {
  const r = analyze(report()); assert.equal(r.verdict, 'CLEAR'); assert.equal(r.counts.passed, 1); assert.equal(r.tests[0].change, 'no-baseline');
});
test('failed retry followed by success preserves error and is flaky', () => {
  const r = analyze(report({ status: 'flaky', results: [{ status: 'failed', retry: 0, errors: [{ message: 'Timeout 100ms exceeded' }] }, { status: 'passed', retry: 1 }] }));
  assert.equal(r.counts.flaky, 1); assert.match(r.tests[0].error, /Timeout/); assert.equal(r.tests[0].attempts.length, 2);
});
test('expected failure is not a normal pass or an unexpected failure', () => {
  const r = analyze(report({ expectedStatus: 'failed', results: [{ status: 'failed' }] }));
  assert.equal(r.counts['expected-failure'], 1); assert.equal(r.counts.passed, 0); assert.equal(r.verdict, 'REVIEW');
});
test('unexpected pass remains an adverse result', () => {
  const r = analyze(report({ status: 'unexpected', expectedStatus: 'failed' }));
  assert.equal(r.counts['unexpected-pass'], 1); assert.equal(shouldFail(r, 'failures'), true);
});
test('interrupted and empty runs cannot appear clear', () => {
  assert.equal(analyze(report({ status: 'unexpected', results: [{ status: 'interrupted' }] })).verdict, 'INCOMPLETE');
  assert.equal(analyze({ suites: [] }).verdict, 'INCOMPLETE');
  assert.equal(shouldFail(analyze({ suites: [] }), 'failures'), true);
});
test('not-run is distinct from skipped and passed', () => {
  const r = analyze(report({ results: [] })); assert.equal(r.counts['not-run'], 1); assert.equal(r.verdict, 'INCOMPLETE');
  assert.equal(analyze(report({ status: 'skipped', results: [] })).counts.skipped, 1);
});
test('run errors block a clear verdict even when tests passed', () => {
  const r = analyze(report({ errors: [{ message: 'Global teardown failed' }] })); assert.equal(r.verdict, 'INCOMPLETE'); assert.equal(r.runErrors.length, 1);
});
test('baseline comparison is stable across line changes', () => {
  const f = failure(); f.suites[0].specs[0].line = 999;
  assert.equal(analyze(f, report()).changes.regression, 1);
});
test('new failing test is not claimed to be a proven regression', () => {
  const f = failure(); f.suites[0].specs[0].title = 'new test'; const r = analyze(f, report());
  assert.equal(r.changes.regression, 0); assert.equal(r.changes['new-test'], 1); assert.equal(shouldFail(r, 'new'), true);
});
test('missing baseline failure is not marked recovered', () => {
  const r = analyze({ suites: [] }, failure()); assert.equal(r.changes.recovered, 0); assert.equal(r.notObserved.length, 1);
});
test('recovery requires an actual pass, not a skip or expected-failure marker', () => {
  assert.equal(analyze(report(), failure()).changes.recovered, 1);
  assert.equal(analyze(report({ status: 'skipped', results: [] }), failure()).changes.recovered, 0);
  assert.equal(analyze(report({ expectedStatus: 'failed', results: [{ status: 'failed' }] }), failure()).changes.recovered, 0);
});
test('a failure after a skipped baseline is unverified', () => {
  const r = analyze(failure(), report({ status: 'skipped', results: [] })); assert.equal(r.tests[0].change, 'unverified'); assert.equal(shouldFail(r, 'new'), true);
});
test('recurring failures do not trigger new-only policy', () => {
  const r = analyze(failure(), failure()); assert.equal(r.changes.recurring, 1); assert.equal(shouldFail(r, 'new'), false);
});
test('different projects remain separate tests', () => {
  const f = failure(); f.suites[0].specs.push(report({ project: 'firefox' }).suites[0].specs[0]);
  assert.equal(analyze(f).total, 2);
});
test('nested describe titles distinguish same named tests', () => {
  const f = { suites: [{ title: 'file', specs: [], suites: [{ title: 'A', specs: report().suites[0].specs }, { title: 'B', specs: report().suites[0].specs }] }] };
  assert.equal(analyze(f).total, 2);
});
test('repeatEach results aggregate conservatively without being lost', () => {
  const f = report(); f.suites[0].specs[0].tests.push(failure().suites[0].specs[0].tests[0]);
  const r = analyze(f); assert.equal(r.total, 1); assert.equal(r.counts.failed, 1); assert.equal(r.tests[0].repetitions, 2); assert.equal(r.tests[0].mixedOutcomes, true); assert.equal(r.tests[0].attempts.length, 2);
});
test('same errors group across projects, differing HTTP codes do not', () => {
  const f = failure(); const second = structuredClone(f.suites[0].specs[0]); second.tests[0].projectName = 'firefox'; f.suites[0].specs.push(second);
  assert.equal(analyze(f).clusters[0].testIds.length, 2);
  second.tests[0].results[0].errors[0].message = 'Expected: 200\nReceived: 401';
  assert.equal(analyze(f).clusters.length, 2);
});
test('malformed report is rejected instead of silently passed', () => {
  for (const f of [{}, { suites: [null] }, report({ status: 'mystery' }), report({ results: [{ status: 'unknown' }] })]) assert.throws(() => analyze(f), /invalid Playwright/);
});
test('triage categories state a suggestion rather than a confirmed bug', () => {
  assert.equal(classify('strict mode violation').category, 'Locator ambiguity');
  assert.equal(classify('ECONNREFUSED').category, 'Environment or network');
  assert.equal(classify('Timeout 30000ms exceeded').confidence, 'low');
});
test('common secrets and terminal control sequences are masked', () => {
  const value = redact('\u001b[31mAuthorization: Bearer abc123 password="top secret" https://a.invalid/?token=xyz a@example.com');
  for (const s of ['abc123', 'top secret', 'xyz', 'a@example.com', '\u001b']) assert.equal(value.includes(s), false);
});
test('raw stdout and attachment bodies never enter output', () => {
  const f = failure(); const a = f.suites[0].specs[0].tests[0].results[0]; a.stdout = [{ text: 'private-stdout' }]; a.attachments = [{ name: 'evidence', body: 'private-body', contentType: 'text/plain' }];
  const output = JSON.stringify(analyze(f)); assert.equal(output.includes('private-body'), false); assert.equal(output.includes('private-stdout'), false); assert.match(output, /inlineBodyOmitted/);
});
test('HTML escapes hostile titles, errors, and attachment paths', () => {
  const f = failure(); f.suites[0].specs[0].title = '<img src=x onerror=alert(1)>';
  f.suites[0].specs[0].tests[0].results[0].errors[0].message = '</script><script>alert(1)</script>';
  const html = renderHtml(analyze(f)); assert.equal(html.includes('<img src=x'), false); assert.equal(html.includes('<script>alert(1)'), false); assert.match(html, /&lt;script&gt;/);
});
test('Markdown drafts contain evidence without fabricated reproduction steps', () => {
  const r = analyze(failure()); assert.match(renderBugDrafts(r), /Manual reproduction steps: not available/); assert.match(renderMarkdown(r), /No baseline/);
});
test('all export formats contain no sample credential value', () => {
  const f = failure(); f.suites[0].specs[0].tests[0].results[0].errors[0].message = 'password=private123';
  const r = analyze(f); for (const output of [JSON.stringify(r), renderHtml(r), renderMarkdown(r), renderBugDrafts(r)]) assert.equal(output.includes('private123'), false);
});
