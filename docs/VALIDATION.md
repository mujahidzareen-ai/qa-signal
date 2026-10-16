# Validation record

Date: 2026-10-16. This record describes checks performed during creation of version 0.1.0; it is not a claim that the tool has been validated on a production application.

| Check | Result |
| --- | --- |
| Node.js syntax checks for analyzer, renderer, and CLI | Passed on Node.js 24.19.0 |
| Unit and CLI checks (`npm test`) | 27 passed; 0 failed; 0 skipped |
| Real Playwright JSON compatibility | Passed with installed Playwright 1.62.1 |
| Actual reporter outcomes | Normal pass, failure, flaky retry, expected failure, unexpected pass, skipped |
| Actual reporter repetitions | `repeatEach: 2` with retries; logical identity and retry preservation verified |
| Demo generation | HTML, Markdown summary, investigation drafts, and JSON generated successfully |
| Generated HTML integrity | Inline script syntax, unique element IDs, internal anchors, and companion download paths checked |
| Browser-based visual/interaction verification | Not completed: no browser executable was available; the browser download returned an invalid archive |
| GitHub Actions matrix | Workflow provided for Linux/Windows and Node 22/24; hosted execution not yet verified |

The compatibility check uses deliberately synthetic assertions and no browser or remote application. Its Playwright exit code of 1 is expected because the fixture intentionally includes failures. The compatibility script validates the resulting report semantics independently.

## Main cases covered

- No-baseline behavior and line-number-independent matching.
- Cross-project and nested-title separation.
- New, recurring, recovered, absent, and insufficiently observed tests.
- Expected failures and unexpected passes.
- Interrupted, skipped, empty, and unexecuted results.
- Top-level run errors and incomplete-run CI behavior.
- Failed retries retained after a successful retry.
- Repeated test executions, including mixed outcomes.
- Similar-message grouping while retaining different HTTP status codes.
- Invalid JSON/schema handling, option errors, and UTF-8 BOM input.
- Output overwrite protection and CI exit codes.
- HTML escaping, credential masking, and omission of stdout/attachment bodies.

## Practical limits

Validation does not establish compatibility with every historical/future Playwright version, every unusual hook/retry combination, or every form of sensitive content. It does not cover real browser rendering, assistive-technology behavior, or large-report performance. Keep the original Playwright report when investigating a failure.
