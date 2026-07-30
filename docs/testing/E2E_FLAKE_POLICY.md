# E2E Flake Policy

X4 Forge has a zero-flake gate. The runner performs one retry so a first-fail/second-pass test is identified as
`flaky`; failed, flaky, interrupted, timed-out, did-not-run, and no-tests outcomes all remain red.

`scripts/e2e-quarantine.json` is ownership metadata, not an allowlist. A matching quarantine never skips a test and
never changes the final verdict. It makes an unstable test name its owner, repair reference, reason, and expiry while
the gate continues to block.

## Limits

- At most three active entries repository-wide.
- Exact Playwright test ids only; no paths, tags, patterns, or wildcards.
- Every entry requires `owner`, `reason`, `issue`, `createdOn`, and `expiresOn`.
- `issue` is a `B` backlog number or an HTTPS URL.
- Lifetime is 1-14 calendar days. Future-created and expired entries fail before Playwright starts.
- Callers cannot override the runner-owned retry or fail-on-flaky settings.

Use the `testId` printed in `test-results/e2e-verdict.json`. Remove the entry when repaired; extending an expiry is a
new reviewed policy change, not an automatic renewal. Never use `test.skip`, `test.fixme`, tags, grep filters, or a
separate non-blocking lane as a substitute for this manifest.

Validation commands:

```text
npm run test:e2e-policy
npm run test:e2e
```

The first command runs a real Playwright fixture that fails attempt zero and passes retry one, matches it to valid
quarantine metadata, and succeeds only when the wrapper still returns a red product verdict.
