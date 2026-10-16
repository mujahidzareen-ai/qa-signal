# Contributing

Use Node.js 22 or newer. Run `npm test` before submitting a change. No dependencies are required for the core tool.

For a parser bug, provide the smallest sanitized JSON report that reproduces the behavior, the Playwright version, expected classification, and actual classification. Never upload real customer data, credentials, traces, or screenshots to a public issue.

Keep status semantics and documented comparison rules explicit. Add regression coverage for changes that could hide failures, mislabel a recovery, leak input data, or alter CI exit codes. Do not classify a failure as a confirmed application bug without evidence.

Prefer small pull requests with a problem statement, resulting behavior, and validation details. New dependencies need a concrete benefit because the tool is intentionally usable without an install step.
