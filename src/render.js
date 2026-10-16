import { isAdverse } from './analyze.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const md = value => esc(value).replace(/[\\`*_[\]{}|]/g, '\\$&').replace(/\r?\n/g, ' ');
const fence = value => {
  const text = String(value || 'No error message was recorded.');
  const size = Math.max(3, ...[...text.matchAll(/`+/g)].map(m => m[0].length + 1));
  const ticks = '`'.repeat(size);
  return `${ticks}text\n${text}\n${ticks}`;
};
const attention = report => report.tests.filter(t => isAdverse(t.outcome));
const attemptsText = row => row.attempts.map(a => `repetition ${a.repetition}, retry ${a.retry}: ${a.status} (${a.durationMs} ms)`).join('\n');

export function renderMarkdown(report) {
  return `# QA Signal — ${md(report.label)}

**Run signal: ${report.verdict}** · ${report.total} logical tests · ${md(report.generatedAt)}

This is an automated triage aid. A clear run is not release approval. Categories are hypotheses, not confirmed root causes.

| Outcome | Count |
| --- | ---: |
${Object.entries(report.counts).map(([s, n]) => `| ${s} | ${n} |`).join('\n')}

${report.hasBaseline ? `Compared with baseline: **${report.changes.regression} regressions**, **${report.changes.recurring} recurring issues**, **${report.changes.recovered} recovered tests**, **${report.notObserved.length} not observed**.` : 'No baseline supplied; regressions cannot be established.'}

## Investigation queue

| Test | Project | Outcome | Change | Suggested investigation |
| --- | --- | --- | --- | --- |
${attention(report).map(t => `| ${md(t.title)} | ${md(t.project || 'default')} | ${t.outcome} | ${t.change} | ${md(t.triage.category)} |`).join('\n') || '| No adverse results | — | — | — | — |'}

## Similar failure messages

${report.clusters.map(c => `- ${md(c.category)}: ${c.testIds.length} test(s). ${md(c.next)}`).join('\n') || 'No failure clusters.'}

## Run-level errors

${report.runErrors.map(fence).join('\n\n') || 'None recorded.'}

## Tests absent from the current run

${report.notObserved.map(t => `- ${md(t.title)} [${md(t.project || 'default')}] — previous: ${t.previousOutcome}; not counted as recovered.`).join('\n') || 'None.'}

## Notes

${report.warnings.map(w => `- ${md(w)}`).join('\n')}
- Counts aggregate repeated executions by file, nested test title, and project. Renames appear as new/absent tests.
- Failure similarity is not proof of a common root cause. Review each member.
- Attachment paths are references only; attachment files and inline bodies are not copied.
- Common secrets are masked on a best-effort basis. Review all outputs before sharing.
`;
}

export function renderBugDrafts(report) {
  return `# QA Signal — investigation drafts

These drafts are not submitted anywhere. Validate the requirement, reproduce the behavior, and assign severity/priority before filing a bug. Automated steps do not establish manual reproduction steps.

${attention(report).map(t => `## ${md(t.title)}

- Project: ${md(t.project || 'default')}
- Source: ${md(t.file)}:${t.line}
- Outcome: ${t.outcome}; baseline: ${t.previousOutcome || 'unavailable'}; change: ${t.change}
- Investigation category: ${md(t.triage.category)} (${t.triage.confidence} heuristic confidence)
- Severity and priority: not assessed
- Expected business behavior: not supplied by the test report; verify the requirement
- Manual reproduction steps: not available in JSON; reconstruct from test source and trace
- Next action: ${md(t.triage.next)}

### Observed error

${fence(t.error)}

### Execution history

${fence(attemptsText(t))}

### Failed steps recorded by Playwright

${t.attempts.flatMap(a => a.failedSteps).map(s => `- ${md(s.title)}: ${md(s.error)}`).join('\n') || 'No failed step details recorded.'}

### Evidence references

${t.attempts.flatMap(a => a.attachments.map(x => `- Retry ${a.retry}, repetition ${a.repetition}: ${md(x.name)} — ${md(x.path || 'inline attachment body omitted')}`)).join('\n') || 'No attachments recorded. Consider enabling trace and screenshots for the next run.'}
`).join('\n---\n\n') || 'No adverse test results to draft. Review run-level errors in summary.md if the run is incomplete.'}
`;
}

export function renderHtml(report) {
  const order = { regression: 0, 'new-test': 1, recurring: 2, unverified: 3, recovered: 4, unchanged: 5, 'no-baseline': 6 };
  const sorted = [...report.tests].sort((a, b) => Number(isAdverse(b.outcome)) - Number(isAdverse(a.outcome)) || order[a.change] - order[b.change]);
  const metric = (name, value, note, color = '') => `<div class="metric ${color}"><span>${esc(name)}</span><strong>${value}</strong><small>${esc(note)}</small></div>`;
  const testCards = sorted.map(t => `<details class="test" data-outcome="${t.outcome}" data-change="${t.change}" id="test-${t.id}">
    <summary><div class="test-name"><span class="dot ${isAdverse(t.outcome) ? 'bad' : t.outcome === 'passed' ? 'good' : 'warn'}"></span><strong>${esc(t.title)}</strong><small>${esc(t.project || 'default')} · ${esc(t.file)}:${t.line}</small></div><div class="badges"><span class="badge">${t.outcome}</span><span class="badge change">${t.change}</span></div></summary>
    <div class="detail">${isAdverse(t.outcome) ? `<div class="advice"><b>${esc(t.triage.category)}</b><span>${esc(t.triage.confidence)} confidence · suggestion only</span><p>${esc(t.triage.next)}</p></div>` : ''}
    <p>Previous outcome: <b>${esc(t.previousOutcome || 'not available')}</b> · ${t.repetitions} repetition(s) · ${(t.durationMs / 1000).toFixed(2)}s total</p>
    ${t.error ? `<h4>Observed error</h4><pre>${esc(t.error)}</pre>` : ''}
    <h4>Execution history</h4><div class="attempts">${t.attempts.map(a => `<section><b>Run ${a.repetition} · Retry ${a.retry} · ${a.status}</b><small>${a.durationMs} ms</small>${a.errors.length ? `<pre>${esc(a.errors.join('\n\n'))}</pre>` : ''}${a.failedSteps.map(s => `<p><b>Step:</b> ${esc(s.title)}</p>`).join('')}${a.attachments.length ? `<ul>${a.attachments.map(x => `<li>${esc(x.name)}: <code>${esc(x.path || 'inline body omitted')}</code></li>`).join('')}</ul>` : '<p class="muted">No attachment references.</p>'}</section>`).join('') || '<p>No attempts recorded.</p>'}</div></div>
    </details>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none'; img-src 'none'"><title>QA Signal · ${esc(report.label)}</title>
<style>
:root{--ink:#17342e;--muted:#5d7068;--line:#d9e2db;--green:#14694f;--paper:#f5f7f2;--red:#a33338;--amber:#8b5915}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--green)}header{background:#163c31;color:#fff;padding:25px max(24px,calc((100vw - 1180px)/2));display:flex;justify-content:space-between;align-items:center;gap:20px}.brand{font-size:22px;font-weight:750;letter-spacing:-.7px}.brand b{color:#b6ec8a}.version{font:12px ui-monospace,monospace;color:#c4d8cd}main{max-width:1228px;margin:auto;padding:44px 24px 32px}.eyebrow{text-transform:uppercase;letter-spacing:2px;font-size:11px;font-weight:750;color:var(--muted)}h1{font-size:clamp(32px,4vw,50px);letter-spacing:-2px;line-height:1.12;margin:12px 0 16px}h2{font-size:23px;letter-spacing:-.5px;margin:0}h3{font-size:16px;margin:0}h4{margin:22px 0 8px}.intro{display:flex;justify-content:space-between;align-items:center;gap:30px;margin-bottom:32px}.intro p{color:var(--muted);max-width:650px;margin:0}.signal{border:1px solid #c7d2c8;background:white;border-radius:10px;padding:16px 22px;min-width:160px}.signal strong{display:block;font-size:18px;letter-spacing:1px}.signal small{color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.metric{background:white;border:1px solid var(--line);padding:20px 23px;border-radius:10px}.metric span{display:block;color:var(--muted);font-size:13px}.metric strong{display:block;font-size:43px;line-height:1.4;font-weight:650;letter-spacing:-1px}.metric small{color:var(--muted);font-size:12px}.metric.red strong{color:var(--red)}.metric.green strong{color:var(--green)}.metric.amber strong{color:var(--amber)}.strip{display:flex;flex-wrap:wrap;gap:7px 23px;padding:14px 0;color:var(--muted);font-size:12px}.panel{margin-top:28px}.section-top{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:15px}.section-top p{font-size:13px;color:var(--muted);margin:2px 0}.clusters{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}.cluster{background:#edf1e9;border:1px solid #d5dfcf;padding:20px;border-radius:9px}.cluster .count{float:right;color:var(--green);font-weight:700}.cluster p{font-size:13px;color:var(--muted);margin:10px 0}.cluster a{font-size:12px}.toolbar{background:#fff;border:1px solid var(--line);padding:14px;display:flex;gap:12px;border-radius:10px;margin-bottom:12px;align-items:end}.toolbar label{display:block;color:var(--muted);font-size:12px;flex:1}.toolbar label:first-child{flex:2}input,select{font:inherit;color:var(--ink);display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #bccbc0;border-radius:6px;background:white;min-height:43px}input:focus,select:focus,summary:focus-visible,a:focus-visible{outline:3px solid #75b493;outline-offset:3px}.test{border:1px solid var(--line);border-radius:8px;background:white;margin:9px 0;overflow:hidden}.test summary{cursor:pointer;padding:18px;display:flex;align-items:center;gap:16px;justify-content:space-between;list-style:none}.test summary::after{content:'+';font-size:20px;color:var(--muted)}.test[open] summary::after{content:'−'}.test-name{flex:1;min-width:0}.test-name strong{font-size:14px;overflow-wrap:anywhere}.test-name small{display:block;color:var(--muted);margin-left:20px;margin-top:3px;font:11px/1.6 ui-monospace,monospace;overflow-wrap:anywhere}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:12px;background:#a5b2a8}.dot.bad{background:#b74849}.dot.good{background:#278160}.dot.warn{background:#c08b34}.badges{display:flex;flex-wrap:wrap;gap:6px}.badge{font-size:10px;padding:3px 9px;border-radius:5px;background:#f0f2ed;color:#53665a;white-space:nowrap}.change{background:#e9f0e5;color:#4c6941}.detail{padding:0 20px 20px;border-top:1px solid var(--line);font-size:13px}.advice{background:#f2f5ee;padding:15px;margin-top:18px;border-left:3px solid #7a9a62}.advice span{display:block;color:var(--muted);font-size:11px}.advice p{margin-bottom:0}.attempts section{border-top:1px solid var(--line);padding:15px 0}.attempts small{display:block;color:var(--muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 ui-monospace,monospace;background:#f2f4f0;border-radius:6px;padding:15px;color:#3b5047;max-height:360px;overflow:auto}code{overflow-wrap:anywhere}.muted{color:var(--muted)}.notes{border-top:1px solid var(--line);margin-top:35px;padding-top:20px;color:var(--muted);font-size:12px}.notes ul{padding-left:20px}.downloads{display:flex;flex-wrap:wrap;gap:20px;margin-top:20px;font-size:13px}footer{margin-top:30px;font-size:11px;color:var(--muted);display:flex;justify-content:space-between;gap:15px}[hidden]{display:none!important}.empty{padding:25px;text-align:center;color:var(--muted)}@media(max-width:800px){.metrics{grid-template-columns:repeat(2,1fr)}.clusters{grid-template-columns:1fr}.intro{align-items:start;flex-direction:column}.signal{width:100%}.toolbar{flex-wrap:wrap}.toolbar label:first-child{flex-basis:100%}.test summary{flex-wrap:wrap}.badges{margin-left:20px}.test summary::after{margin-left:auto}main{padding-top:28px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}@media print{header{background:white;color:#17342e}.toolbar,.downloads{display:none}main{padding:10px}.test,.cluster,.metric{break-inside:avoid}.metrics{grid-template-columns:repeat(4,1fr)}pre{max-height:none}}
</style></head><body>
<header><div class="brand">qa<span> signal</span><b> /</b></div><div class="version">LOCAL TRIAGE · v0.1</div></header>
<main><div class="intro"><div><div class="eyebrow">Test results → next actions</div><h1>Find the signal.<br>Focus your investigation.</h1><p>${esc(report.label)} · ${report.hasBaseline ? 'Compared with a previous run.' : 'Single-run analysis; no baseline supplied.'} Open a test to review its evidence and retry history.</p></div><div class="signal"><small>RUN SIGNAL</small><strong>${report.verdict}</strong><small>${report.total} logical tests</small></div></div>
<div class="metrics">${metric('Unexpected failures', report.counts.failed + report.counts['unexpected-pass'], 'Needs investigation', 'red')}${metric('Flaky tests', report.counts.flaky, 'Inconsistent retry outcomes', 'amber')}${metric('Regressions', report.hasBaseline ? report.changes.regression : '—', 'Previously passed, now adverse', 'red')}${metric('Recovered', report.hasBaseline ? report.changes.recovered : '—', 'Previously adverse, now passed', 'green')}</div>
<div class="strip"><span>${report.counts.passed} passed</span><span>${report.counts.skipped} skipped</span><span>${report.counts['expected-failure']} expected failures</span><span>${report.counts.interrupted} interrupted</span><span>${report.counts['not-run']} not run</span><span>${report.notObserved.length} absent from current run</span></div>
${report.clusters.length ? `<section class="panel"><div class="section-top"><div><h2>Investigation starting points</h2><p>Similar messages, grouped conservatively. A shared cause still needs verification.</p></div></div><div class="clusters">${report.clusters.map(c => `<article class="cluster"><span class="count">${c.testIds.length} test${c.testIds.length === 1 ? '' : 's'}</span><h3>${esc(c.category)}</h3><p>${esc(c.next)}</p><a href="#test-${c.testIds[0]}" class="jump">Inspect evidence →</a></article>`).join('')}</div></section>` : ''}
<section class="panel"><div class="section-top"><div><h2>Test investigation queue</h2><p>Failures first. Search by test, file, project, or error text.</p></div><span id="visible-count" class="muted" aria-live="polite">${report.total} tests</span></div>
<div class="toolbar"><label>Search<input id="search" type="search" placeholder="Search tests, files, errors…"></label><label>Outcome<select id="outcome"><option value="all">All outcomes</option><option value="attention">Needs investigation</option>${Object.keys(report.counts).map(s => `<option value="${s}">${s}</option>`).join('')}</select></label><label>Change<select id="change"><option value="all">All changes</option>${['regression', 'recurring', 'recovered', 'new-test', 'unverified', 'unchanged', 'no-baseline'].map(s => `<option value="${s}">${s}</option>`).join('')}</select></label></div>
<div id="tests">${testCards}</div><p class="empty" id="no-matches" ${report.total ? 'hidden' : ''}>No matching tests.</p></section>
${report.runErrors.length ? `<section class="panel"><h2>Run-level errors</h2>${report.runErrors.map(e => `<pre>${esc(e)}</pre>`).join('')}</section>` : ''}
${report.notObserved.length ? `<section class="panel"><h2>Not observed in this run</h2><p class="muted">These tests may have been filtered, renamed, deleted, or blocked. They are not counted as recovered.</p><ul>${report.notObserved.map(t => `<li>${esc(t.title)} · ${esc(t.project || 'default')} · previously ${t.previousOutcome}</li>`).join('')}</ul></section>` : ''}
<div class="downloads"><a href="summary.md" download>Download summary</a><a href="bug-drafts.md" download>Download investigation drafts</a><a href="report.json" download>Download structured results</a></div>
<div class="notes"><b>Read the evidence before deciding.</b><ul><li>Categories are heuristic suggestions. A clear run is not release approval.</li><li>References to attachments are retained; files and inline bodies are not copied or opened.</li><li>Common secrets are masked on a best-effort basis. Review reports before sharing.</li>${report.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div><footer><span>QA Signal · Built for practical QA work</span><span>${esc(report.generatedAt)}</span></footer></main>
<script>
const rows=Array.from(document.querySelectorAll('.test'));
const search=document.querySelector('#search'),outcome=document.querySelector('#outcome'),change=document.querySelector('#change');
function filter(){let visible=0;const query=search.value.toLowerCase();rows.forEach(row=>{const o=row.dataset.outcome;const matches=(!query||row.textContent.toLowerCase().includes(query))&&(outcome.value==='all'||outcome.value===o||(outcome.value==='attention'&&['failed','flaky','interrupted','unexpected-pass'].includes(o)))&&(change.value==='all'||change.value===row.dataset.change);row.hidden=!matches;if(matches)visible++;});document.querySelector('#visible-count').textContent=visible+' of '+rows.length+' tests';document.querySelector('#no-matches').hidden=visible>0;}
[search,outcome,change].forEach(el=>el.addEventListener('input',filter));
document.querySelectorAll('.jump').forEach(link=>link.addEventListener('click',()=>{search.value='';outcome.value='all';change.value='all';filter();const target=document.getElementById(link.getAttribute('href').slice(1));if(target)target.open=true;}));
</script></body></html>`;
}
