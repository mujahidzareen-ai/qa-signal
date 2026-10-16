# QA Signal — Fictional shop · Regression run

**Run signal: FAILURES** · 9 logical tests · 2026-10-16T12:11:14.862Z

This is an automated triage aid. A clear run is not release approval. Categories are hypotheses, not confirmed root causes.

| Outcome | Count |
| --- | ---: |
| passed | 2 |
| failed | 4 |
| flaky | 1 |
| skipped | 1 |
| expected-failure | 1 |
| unexpected-pass | 0 |
| interrupted | 0 |
| not-run | 0 |

Compared with baseline: **2 regressions**, **2 recurring issues**, **1 recovered tests**, **1 not observed**.

## Investigation queue

| Test | Project | Outcome | Change | Suggested investigation |
| --- | --- | --- | --- | --- |
| Shop workflow &gt; Checkout returns a successful response | chromium | failed | regression | Assertion mismatch |
| Shop workflow &gt; Catalog is reachable | chromium | failed | recurring | Environment or network |
| Shop workflow &gt; Search is reachable | firefox | failed | recurring | Environment or network |
| Shop workflow &gt; Receipt appears after payment | chromium | flaky | regression | Timeout |
| Shop workflow &gt; Order helper parses a reference | chromium | failed | new-test | Runtime exception |

## Similar failure messages

- Assertion mismatch: 1 test(s). Compare expected and actual behavior against the requirement. Inspect trace, data, and locator before filing a defect.
- Environment or network: 2 test(s). Check service reachability, baseURL, DNS, and CI network logs. This symptom does not establish an application defect.
- Timeout: 1 test(s). Review the failing step, trace, network, and page state. Check app readiness and locator correctness; do not simply increase the timeout.
- Runtime exception: 1 test(s). Inspect the stack and failing step to establish whether the exception originates in test code or the application.

## Run-level errors

None recorded.

## Tests absent from the current run

- Shop workflow &gt; Legacy address validation [chromium] — previous: failed; not counted as recovered.

## Notes

- 1 baseline tests are absent from this run. They are not counted as recovered.
- Counts aggregate repeated executions by file, nested test title, and project. Renames appear as new/absent tests.
- Failure similarity is not proof of a common root cause. Review each member.
- Attachment paths are references only; attachment files and inline bodies are not copied.
- Common secrets are masked on a best-effort basis. Review all outputs before sharing.
