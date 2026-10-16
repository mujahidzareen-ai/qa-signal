// Optional real-reporter compatibility check. Requires Playwright to be installed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

(async () => {
  const packageDir = process.env.PLAYWRIGHT_PACKAGE_DIR || path.dirname(require.resolve('playwright/package.json'));
  const modulePath = path.join(packageDir, 'test.js');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-signal-compat-'));
  try {
    const config = `module.exports={testDir:'.',retries:1,workers:1,repeatEach:2,reporter:[['json',{outputFile:'results.json'}]]};`;
    fs.writeFileSync(path.join(temp, 'playwright.config.cjs'), config);
    fs.writeFileSync(path.join(temp, 'sample.spec.cjs'), `
const {test,expect}=require(${JSON.stringify(modulePath)});
test('normal pass',()=>expect(1).toBe(1));
test('normal failure',()=>expect(1).toBe(2));
test('flaky retry',({},info)=>expect(info.retry).toBe(1));
test('expected failure',()=>{test.fail();expect(1).toBe(2);});
test('unexpected pass',()=>{test.fail();expect(1).toBe(1);});
test.skip('skipped test',()=>{});
`);
    const result = spawnSync(process.execPath, [path.join(packageDir, 'cli.js'), 'test', '--config', 'playwright.config.cjs'], { cwd: temp, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 1, `Synthetic failures should exit 1: ${result.stderr}`);
    const raw = JSON.parse(fs.readFileSync(path.join(temp, 'results.json'), 'utf8'));
    const { analyze } = await import('../src/analyze.js');
    const r = analyze(raw);
    assert.equal(r.total, 6);
    for (const s of ['passed','failed','flaky','expected-failure','unexpected-pass','skipped']) assert.equal(r.counts[s], 1, s);
    assert.ok(r.tests.every(t=>t.repetitions===2));
    assert.equal(r.tests.find(t=>t.outcome==='flaky').attempts.length, 4);
    console.log(`PASS: actual Playwright ${require(path.join(packageDir,'package.json')).version} JSON; six outcomes and repeatEach/retries verified.`);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error=>{console.error(error);process.exitCode=1;});
