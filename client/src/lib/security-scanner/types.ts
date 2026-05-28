/**
 * Security Scanner — shared types
 *
 * Each check returns a Finding. Severity drives the overall score deduction
 * (see SEVERITY_WEIGHTS). A finding may include a fixAction that the UI
 * surfaces as a "Fix" button — onClick is wired up in the page.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Category = 'browser' | 'device' | 'vault' | 'network';

export interface FixAction {
  label: string;
  /** Route in the app (wouter href). The page navigates here on click. */
  href?: string;
  /** Free-form action key the page can switch on for in-place fixes. */
  actionKey?: string;
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  /** true = check passed (no issue). false = problem detected. */
  passed: boolean;
  /** Optional remediation. */
  fix?: FixAction;
  /** Optional extra context — error string, value etc. Shown in detail view. */
  detail?: string;
}

export interface CategoryResult {
  category: Category;
  label: string;
  findings: Finding[];
  /** 0-100 score for this category. */
  score: number;
  /** "A".."F" letter grade. */
  grade: string;
}

export interface ScanResult {
  /** Unique id for this scan run (used as IndexedDB key). */
  id: string;
  /** ISO timestamp. */
  scannedAt: string;
  /** Total time taken in ms. */
  durationMs: number;
  /** 0-100 overall score. */
  score: number;
  /** "A".."F" letter grade derived from score. */
  grade: string;
  categories: CategoryResult[];
  /** Flat list of all findings across categories, for "Top issues" rendering. */
  allFindings: Finding[];
  /** Platform we ran on — affects which checks were available. */
  platform: 'web' | 'ios' | 'android';
}

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 1,
};

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
