import { expect, test } from '@playwright/test';

test('a retry-pass is still a blocking flake', async ({}, testInfo) => {
  expect(testInfo.retry, 'attempt zero must fail and retry one must pass').toBe(1);
});
