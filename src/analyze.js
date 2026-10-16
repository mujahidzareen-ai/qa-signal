import { createHash } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const adverse = new Set(['failed', 'flaky', 'interrupted', 'unexpected-pass']);
const statuses = new Set(['expected', 'unexpected', 'flaky', 'skipped']);
const resultStatuses = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
export const isAdverse = outcome => adverse.has(outcome);

// Deliberately best-effort: arbitrary secrets and screenshots require human review.
export function redact(value) {
  return stripVTControlCharacters(String(value ?? ''))
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi, '$1 [REDACTED]')
    .replace(/(["']?(?:password|passwd|secret|token|api[-_]?key|authorization|access_token|refresh_token|client_secret)["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s&,;]+)/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|key|password|secret|api_key|access_token)=)[^&#\s]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
}

function message(error) {
  return redact(typeof error === 'string' ? error : error?.message || error?.value || error?.stack || '');
}

export function classify(error) {
  if (/strict mode violation/i.test(error)) return { category: 'Locator ambiguity', confidence: 'high', next: 'Inspect matching elements and scope the locator. Confirm the intended element before changing the test.' };
  if (/ECONNREFUSED|ENOTFOUND|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ECONNRESET/i.test(error)) return { category: 'Environment or network', confidence: 'medium', next: 'Check service reachability, baseURL, DNS, and CI network logs. This symptom does not establish an application defect.' };
  if (/browser.*(?:closed|crash)|target.*closed|Executable doesn't exist|browserType\.launch/i.test(error)) return { category: 'Browser or runner', confidence: 'medium', next: 'Review browser installation, worker logs, resource limits, and unexpected page closure.' };
  if (/ReferenceError|TypeError|SyntaxError|Cannot find module|is not defined/i.test(error)) return { category: 'Runtime exception', confidence: 'medium', next: 'Inspect the stack and failing step to establish whether the exception originates in test code or the application.' };
  if (/expect\(|Expected:|Received:|toBeVisible|toHaveText|toEqual|toBe\(/i.test(error)) return { category: 'Assertion mismatch', confidence: 'medium', next: 'Compare expected and actual behavior against the requirement. Inspect trace, data, and locator before filing a defect.' };
  if (/Timeout|timed out|timeout.*exceeded/i.test(error)) return { category: 'Timeout', confidence: 'low', next: 'Review the failing step, trace, network, and page state. Check app readiness and locator correctness; do not simply increase the timeout.' };
  return { category: 'Needs investigation', confidence: 'low', next: 'Inspect the original run and available evidence. There is insufficient information to infer a cause.' };
}

function outcome(test) {
  if (!test.results.length) return test.status === 'skipped' ? 'skipped' : 'not-run';
  if (test.results.some(r => r.status === 'interrupted')) return 'interrupted';
  if (test.status === 'skipped') return 'skipped';
  if (test.status === 'flaky') return 'flaky';
  if (test.status === 'unexpected') return test.results.at(-1).status === 'passed' ? 'unexpected-pass' : 'failed';
  if (test.expectedStatus === 'failed') return 'expected-failure';
  return 'passed';
}

function validateReport(report, label) {
  const fail = reason => { throw new Error(`${label}: invalid Playwright JSON report (${reason}). Use the built-in JSON reporter.`); };
  if (!report || typeof report !== 'object' || !Array.isArray(report.suites)) fail('missing suites array');
  if (report.errors !== undefined && !Array.isArray(report.errors)) fail('errors must be an array');
  function walk(suite) {
    if (!suite || typeof suite !== 'object' || !Array.isArray(suite.specs)) fail('suite.specs must be an array');
    if (suite.suites !== undefined && !Array.isArray(suite.suites)) fail('suite.suites must be an array');
    for (const spec of suite.specs) {
      if (!spec || typeof spec.title !== 'string' || !Array.isArray(spec.tests)) fail('invalid spec');
      for (const test of spec.tests) {
        if (!test || !statuses.has(test.status) || !Array.isArray(test.results)) fail('invalid test status or results');
        if (!resultStatuses.has(test.expectedStatus)) fail('invalid expectedStatus');
        for (const r of test.results) {
          if (!r || !resultStatuses.has(r.status)) fail('unknown attempt status');
          if (r.errors !== undefined && !Array.isArray(r.errors)) fail('invalid attempt errors');
          if (r.attachments !== undefined && !Array.isArray(r.attachments)) fail('invalid attachments');
        }
      }
    }
    for (const child of suite.suites || []) walk(child);
  }
  report.suites.forEach(walk);
}

function failedSteps(steps, prefix = []) {
  const found = [];
  for (const step of Array.isArray(steps) ? steps : []) {
    const titles = [...prefix, String(step.title || 'Unnamed step')];
    if (step.error) found.push({ title: redact(titles.join(' > ')), error: message(step.error) });
    found.push(...failedSteps(step.steps, titles));
  }
  return found;
}

function flatten(report, label) {
  validateReport(report, label);
  const groups = new Map();
  const warnings = [];
  function walk(suite, parents, depth) {
    // The first suite is the file container; retain every nested describe title.
    const titles = depth ? [...parents, suite.title || ''] : parents;
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const file = String(spec.file || suite.file || '').replaceAll('\\', '/');
        const project = String(test.projectName ?? test.projectId ?? '');
        // Source line is excluded so adding lines above a test doesn't erase history.
        const key = JSON.stringify([file, titles, spec.title, project]);
        if (!groups.has(key)) groups.set(key, {
          id: hash(key), title: redact([...titles, spec.title].filter(Boolean).join(' > ')),
          file: redact(file), line: Number(spec.line) || 0, project: redact(project),
          tags: (Array.isArray(spec.tags) ? spec.tags : []).map(redact),
          repetitions: 0, outcomes: [], attempts: [], expectedStatuses: [],
        });
        const row = groups.get(key);
        row.repetitions++;
        row.outcomes.push(outcome(test));
        row.expectedStatuses.push(test.expectedStatus);
        for (const r of test.results) {
          const errors = [...new Set([...(r.errors || []).map(message), message(r.error)].filter(Boolean))];
          row.attempts.push({
            repetition: row.repetitions, retry: Number(r.retry) || 0, status: r.status,
            durationMs: Math.max(0, Number(r.duration) || 0), errors,
            failedSteps: failedSteps(r.steps),
            attachments: (r.attachments || []).filter(Boolean).map(a => ({
              name: redact(a.name), path: a.path ? redact(a.path) : null,
              contentType: redact(a.contentType), inlineBodyOmitted: a.body !== undefined,
            })),
          });
        }
      }
    }
    for (const child of suite.suites || []) walk(child, titles, depth + 1);
  }
  for (const suite of report.suites) walk(suite, [], 0);
  const priority = ['interrupted', 'failed', 'unexpected-pass', 'flaky', 'not-run', 'skipped', 'expected-failure', 'passed'];
  const tests = [...groups.values()].map(row => {
    row.outcome = priority.find(s => row.outcomes.includes(s));
    row.mixedOutcomes = new Set(row.outcomes).size > 1;
    row.durationMs = row.attempts.reduce((n, a) => n + a.durationMs, 0);
    row.error = row.attempts.flatMap(a => a.errors).at(-1) || (row.outcome === 'unexpected-pass' ? 'Test passed but was marked as expected to fail.' : '');
    row.triage = classify(row.error);
    if (row.repetitions > 1) warnings.push(`${row.title} [${row.project || 'default'}]: ${row.repetitions} entries aggregated by identity; may be repeatEach or duplicate titles.`);
    return row;
  });
  return { tests, errors: (report.errors || []).map(message).filter(Boolean), warnings };
}

function fingerprint(row) {
  // Conservative grouping preserves assertion values, selectors, and HTTP status codes.
  const normalized = row.error.replace(/\r\n/g, '\n').replace(/\b\d+(?:\.\d+)?ms\b/g, '<duration>').replace(/:\d+:\d+(?=\)?(?:\n|$))/g, ':<line>:<column>').trim();
  return hash(`${row.triage.category}\n${normalized || row.id}`);
}

export function analyze(currentReport, baselineReport = null, { label = 'Current run' } = {}) {
  const current = flatten(currentReport, 'Current input');
  const baseline = baselineReport ? flatten(baselineReport, 'Baseline input') : null;
  const previous = new Map((baseline?.tests || []).map(t => [t.id, t]));
  for (const row of current.tests) {
    const old = previous.get(row.id);
    row.previousOutcome = old?.outcome || null;
    row.change = !baseline ? 'no-baseline' : !old ? 'new-test'
      : isAdverse(row.outcome) && isAdverse(old.outcome) ? 'recurring'
      : isAdverse(row.outcome) && old.outcome === 'passed' ? 'regression'
      : row.outcome === 'passed' && isAdverse(old.outcome) ? 'recovered'
      : row.outcome === old.outcome ? 'unchanged' : 'unverified';
  }
  const counts = Object.fromEntries(['passed', 'failed', 'flaky', 'skipped', 'expected-failure', 'unexpected-pass', 'interrupted', 'not-run'].map(s => [s, current.tests.filter(t => t.outcome === s).length]));
  const grouped = new Map();
  for (const row of current.tests.filter(t => isAdverse(t.outcome))) {
    const id = fingerprint(row);
    if (!grouped.has(id)) grouped.set(id, { id, ...row.triage, example: row.error, testIds: [] });
    grouped.get(id).testIds.push(row.id);
  }
  const ids = new Set(current.tests.map(t => t.id));
  const notObserved = (baseline?.tests || []).filter(t => !ids.has(t.id)).map(t => ({ id: t.id, title: t.title, project: t.project, file: t.file, previousOutcome: t.outcome }));
  const warnings = [...current.warnings];
  if (baseline?.errors.length) warnings.push('Baseline contains run-level errors; comparisons may be incomplete.');
  if (baseline?.warnings.length) warnings.push(...baseline.warnings.map(w => `Baseline: ${w}`));
  if (notObserved.length) warnings.push(`${notObserved.length} baseline tests are absent from this run. They are not counted as recovered.`);
  if (!current.tests.length) warnings.push('No tests found. This is not evidence of a passing build.');
  const verdict = current.errors.length || counts.interrupted || counts['not-run'] || !current.tests.length ? 'INCOMPLETE'
    : counts.failed || counts['unexpected-pass'] ? 'FAILURES'
    : counts.flaky || counts.skipped || counts['expected-failure'] ? 'REVIEW' : 'CLEAR';
  return {
    schemaVersion: 1, tool: 'QA Signal', generatedAt: new Date().toISOString(), label: redact(label),
    hasBaseline: Boolean(baseline), verdict, counts, total: current.tests.length,
    changes: Object.fromEntries(['regression', 'recurring', 'recovered', 'new-test', 'unverified'].map(s => [s, current.tests.filter(t => t.change === s).length])),
    tests: current.tests, clusters: [...grouped.values()], notObserved, runErrors: current.errors, warnings,
  };
}

export function shouldFail(report, policy = 'none') {
  if (policy === 'none') return false;
  if (report.verdict === 'INCOMPLETE') return true;
  if (policy === 'new') return report.tests.some(t => isAdverse(t.outcome) && ['regression', 'new-test', 'unverified', 'no-baseline'].includes(t.change));
  if (policy === 'unstable') return report.tests.some(t => isAdverse(t.outcome));
  return report.tests.some(t => ['failed', 'unexpected-pass', 'interrupted'].includes(t.outcome));
}
