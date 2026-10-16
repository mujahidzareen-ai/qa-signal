# QA Signal — investigation drafts

These drafts are not submitted anywhere. Validate the requirement, reproduce the behavior, and assign severity/priority before filing a bug. Automated steps do not establish manual reproduction steps.

## Shop workflow &gt; Checkout returns a successful response

- Project: chromium
- Source: tests/shop.spec.js:15
- Outcome: failed; baseline: passed; change: regression
- Investigation category: Assertion mismatch (medium heuristic confidence)
- Severity and priority: not assessed
- Expected business behavior: not supplied by the test report; verify the requirement
- Manual reproduction steps: not available in JSON; reconstruct from test source and trace
- Next action: Compare expected and actual behavior against the requirement. Inspect trace, data, and locator before filing a defect.

### Observed error

```text
Error: expect(received).toBe(expected)
Expected: 200
Received: 500
```

### Execution history

```text
repetition 1, retry 0: failed (3000 ms)
```

### Failed steps recorded by Playwright

- Validate expected state: Error: expect(received).toBe(expected) Expected: 200 Received: 500

### Evidence references

No attachments recorded. Consider enabling trace and screenshots for the next run.

---

## Shop workflow &gt; Catalog is reachable

- Project: chromium
- Source: tests/shop.spec.js:32
- Outcome: failed; baseline: failed; change: recurring
- Investigation category: Environment or network (medium heuristic confidence)
- Severity and priority: not assessed
- Expected business behavior: not supplied by the test report; verify the requirement
- Manual reproduction steps: not available in JSON; reconstruct from test source and trace
- Next action: Check service reachability, baseURL, DNS, and CI network logs. This symptom does not establish an application defect.

### Observed error

```text
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://demo.invalid/catalog
```

### Execution history

```text
repetition 1, retry 0: failed (3000 ms)
```

### Failed steps recorded by Playwright

- Validate expected state: Error: page.goto: net::ERR\_CONNECTION\_REFUSED at https://demo.invalid/catalog

### Evidence references

No attachments recorded. Consider enabling trace and screenshots for the next run.

---

## Shop workflow &gt; Search is reachable

- Project: firefox
- Source: tests/shop.spec.js:48
- Outcome: failed; baseline: failed; change: recurring
- Investigation category: Environment or network (medium heuristic confidence)
- Severity and priority: not assessed
- Expected business behavior: not supplied by the test report; verify the requirement
- Manual reproduction steps: not available in JSON; reconstruct from test source and trace
- Next action: Check service reachability, baseURL, DNS, and CI network logs. This symptom does not establish an application defect.

### Observed error

```text
Error: page.goto: net::ERR_CONNECTION_REFUSED at https://demo.invalid/catalog
```

### Execution history

```text
repetition 1, retry 0: failed (3000 ms)
```

### Failed steps recorded by Playwright

- Validate expected state: Error: page.goto: net::ERR\_CONNECTION\_REFUSED at https://demo.invalid/catalog

### Evidence references

No attachments recorded. Consider enabling trace and screenshots for the next run.

---

## Shop workflow &gt; Receipt appears after payment

- Project: chromium
- Source: tests/shop.spec.js:65
- Outcome: flaky; baseline: passed; change: regression
- Investigation category: Timeout (low heuristic confidence)
- Severity and priority: not assessed
- Expected business behavior: not supplied by the test report; verify the requirement
- Manual reproduction steps: not available in JSON; reconstruct from test source and trace
- Next action: Review the failing step, trace, network, and page state. Check app readiness and locator correctness; do not simply increase the timeout.

### Observed error

```text
TimeoutError: locator.waitFor: Timeout 3000ms exceeded.
```

### Execution history

```text
repetition 1, retry 0: failed (3000 ms)
repetition 1, retry 1: passed (425 ms)
```

### Failed steps recorded by Playwright

- Validate expected state: TimeoutError: locator.waitFor: Timeout 3000ms exceeded.

### Evidence references

No attachments recorded. Consider enabling trace and screenshots for the next run.

---

## Shop workflow &gt; Order helper parses a reference

- Project: chromium
- Source: tests/shop.spec.js:140
- Outcome: failed; baseline: unavailable; change: new-test
- Investigation category: Runtime exception (medium heuristic confidence)
- Severity and priority: not assessed
- Expected business behavior: not supplied by the test report; verify the requirement
- Manual reproduction steps: not available in JSON; reconstruct from test source and trace
- Next action: Inspect the stack and failing step to establish whether the exception originates in test code or the application.

### Observed error

```text
TypeError: Cannot read properties of undefined (reading "reference")
```

### Execution history

```text
repetition 1, retry 0: failed (3000 ms)
```

### Failed steps recorded by Playwright

- Validate expected state: TypeError: Cannot read properties of undefined (reading &quot;reference&quot;)

### Evidence references

No attachments recorded. Consider enabling trace and screenshots for the next run.

