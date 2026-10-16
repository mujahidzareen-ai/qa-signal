import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fictional examples, deliberately unrelated to any employer or client.
function spec(title, status, error = '', line = 10, project = 'chromium') {
  const attempt = (state, retry) => ({ workerIndex: 0, parallelIndex: 0, retry, status: state, duration: state === 'passed' ? 425 : 3000, startTime: '2026-10-16T10:00:00.000Z', errors: state === 'passed' || state === 'skipped' ? [] : [{ message: error }], stdout: [], stderr: [], attachments: [], steps: state === 'passed' ? [] : [{ title: 'Validate expected state', duration: 3000, error: { message: error } }] });
  return {
    title, file: 'tests/shop.spec.js', line, column: 1, tags: ['@demo'], ok: status !== 'unexpected', id: title,
    tests: [{ projectName: project, projectId: project, expectedStatus: 'passed', timeout: 30000, annotations: [], status,
      results: status === 'flaky' ? [attempt('failed', 0), attempt('passed', 1)] : [attempt(status === 'expected' ? 'passed' : status === 'skipped' ? 'skipped' : 'failed', 0)] }],
  };
}

const assertion = 'Error: expect(received).toBe(expected)\nExpected: 200\nReceived: 500';
const network = 'Error: page.goto: net::ERR_CONNECTION_REFUSED at https://demo.invalid/catalog';
const current = [
  spec('Checkout returns a successful response', 'unexpected', assertion, 15),
  spec('Catalog is reachable', 'unexpected', network, 32),
  spec('Search is reachable', 'unexpected', network, 48, 'firefox'),
  spec('Receipt appears after payment', 'flaky', 'TimeoutError: locator.waitFor: Timeout 3000ms exceeded.', 65),
  spec('Login accepts valid credentials', 'expected', '', 80),
  spec('Profile changes are saved', 'expected', '', 95),
  spec('Refund workflow', 'skipped', '', 110),
  spec('Known tax rounding limitation', 'expected', '', 125),
  spec('Order helper parses a reference', 'unexpected', 'TypeError: Cannot read properties of undefined (reading "reference")', 140),
];
current[7].tests[0].expectedStatus = 'failed';
current[7].tests[0].results[0].status = 'failed';
current[7].tests[0].results[0].errors = [{ message: 'Expected: 10.25\nReceived: 10.24' }];

const baseline = [
  spec(current[0].title, 'expected', '', 12),
  spec(current[1].title, 'unexpected', network, 29),
  spec(current[2].title, 'unexpected', network, 45, 'firefox'),
  spec(current[3].title, 'expected', '', 62),
  spec(current[4].title, 'expected', '', 77),
  spec(current[5].title, 'unexpected', 'Expected: Saved\nReceived: Error', 92),
  spec(current[6].title, 'skipped', '', 107),
  structuredClone(current[7]),
  spec('Legacy address validation', 'unexpected', 'Expected: valid\nReceived: invalid', 155),
];

for (const [name, specs] of Object.entries({ current, baseline })) {
  const report = { config: { version: 'synthetic-demo', rootDir: '/demo', projects: [] }, suites: [{ title: 'tests/shop.spec.js', file: 'tests/shop.spec.js', line: 0, column: 0, specs: [], suites: [{ title: 'Shop workflow', file: 'tests/shop.spec.js', line: 1, column: 1, specs }] }], errors: [], stats: { startTime: '2026-10-16T10:00:00.000Z', duration: 15000 } };
  writeFileSync(fileURLToPath(new URL(`./${name}.json`, import.meta.url)), JSON.stringify(report, null, 2) + '\n');
}
