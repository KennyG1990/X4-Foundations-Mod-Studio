import { expect, test } from '@playwright/test';
import { seedServerWorkspace, readServerWorkspace } from './ephemeral';

/**
 * B19 slice 1 — guided rail (Vision v2 Phase 1 keystone).
 *
 * Proves the newcomer flow the old onboarding abandoned: empty canvas → onboarding
 * picker → click a starter template → the guided rail appears and walks steps
 * 1 (tweak) → 2 (deploy) → 3 (see it in game) → dismiss.
 *
 * DELIBERATELY NEVER CLICKS "Deploy to X4" — that would write into the real game
 * extensions folder (the ephemeral stack still reads this checkout's config.json).
 * Step 2 is asserted present, not executed (deploy-verify has its own coverage; the
 * rail reuses it verbatim).
 *
 * B31s2: runs against the EPHEMERAL e2e stack — the empty fixture is seeded into the
 * ephemeral server; the template the spec loads syncs there for real. No routes.
 */

type E2EWorkspace = { id?: string; name: string; nodes: unknown[]; links: unknown[]; [k: string]: unknown };
type E2EWindow = Window & {
  __X4_E2E__?: {
    getWorkspace: () => E2EWorkspace;
    setWorkspace: (workspace: E2EWorkspace) => void;
  };
};

const emptyFixture: E2EWorkspace = {
  id: 'e2e_rail_empty',
  name: 'E2E_Rail_Empty',
  version: '1.0.0',
  author: 'Playwright',
  description: 'Guided-rail harness fixture (empty → onboarding shows)',
  nodes: [],
  links: [],
  uiWidgets: [],
};

test('template click summons the guided rail and walks all three steps', async ({ page }) => {
  await seedServerWorkspace(emptyFixture);
  await page.addInitScript(() => {
    localStorage.removeItem('x4_mod_studio_workspace');
    localStorage.removeItem('x4_mod_studio_version');
  });
  await page.goto('/');
  await expect(page.getByTestId('grid-canvas')).toBeVisible();
  await page.waitForFunction(() => !!(window as E2EWindow).__X4_E2E__);
  await page.waitForTimeout(650);

  // Empty workspace adopted → onboarding picker is up.
  await expect(page.getByTestId('template-welcome')).toBeVisible();

  // Load the starter → rail appears on step 1 with the template's tweak hint.
  await page.getByTestId('template-welcome').click();
  await expect(page.getByTestId('guided-rail')).toBeVisible();
  await expect(page.getByTestId('rail-tweak')).toContainText('Welcome Message');
  await expect(page.getByTestId('rail-tweak')).toContainText('show_help');

  // Step 2: deploy button present — NOT clicked (writes to the real game dir).
  await page.getByTestId('rail-next').click();
  await expect(page.getByTestId('rail-deploy')).toBeVisible();

  // Step 3 via the chip: watcher status renders.
  // The performance HUD continuously re-renders the rail subtree; invoke the semantic
  // button action directly so Playwright does not require a detached/replaced node to
  // remain layout-stable between pointer down/up. The next assertion proves the action.
  await page.getByTestId('rail-step-3').evaluate(element => (element as HTMLButtonElement).click());
  await expect(page.getByTestId('rail-game')).toBeVisible();

  // Dismiss → rail gone.
  await page.getByTestId('rail-close').click();
  await expect(page.getByTestId('guided-rail')).toHaveCount(0);

  // The loaded template synced to the EPHEMERAL server for real (no route theater):
  // its active workspace is now the welcome template, and nothing here touched the
  // live dev stack — isolation is the config's job, not this spec's.
  await expect.poll(async () => (await readServerWorkspace()).name, {
    timeout: 15_000,
    message: 'the selected template should finish its queued CAS save before the page closes',
  }).toBe('X4_Welcome_Message');
});
