/**
 * Playwright deep-sweep config — runs the full prod E2E suite
 * (full-sweep + deep-verify + admin-deep-verify) against
 * https://www.ironvault.app on both desktop and mobile projects.
 *
 * Usage:
 *   npx playwright test --config playwright.deep-sweep.config.ts --project=prod-desktop-chrome
 *   npx playwright test --config playwright.deep-sweep.config.ts --project=prod-mobile-chrome
 *
 * Re-exports playwright.prod.config.ts (single source of truth for the prod
 * suite). Kept as a separate file so the QA "deep sweep" name remains stable
 * even if the prod harness is restructured.
 */

export { default } from './playwright.prod.config';
