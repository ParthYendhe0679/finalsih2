/**
 * Where "Plan Your Voyage" / "Start Your Voyage" sends the visitor.
 *
 * This landing page ships on its own; the operations desktop is a separate
 * build owned by another team member. Point this at wherever that app is
 * served and every CTA on the page follows automatically:
 *
 *   same origin  →  '/dashboard'
 *   separate dev →  'http://localhost:3000'
 *   deployed     →  'https://desk.sagarsetu.in'
 */
export const DASHBOARD_URL = '#dashboard';

/** Anchor targets used by the nav and the secondary hero CTA. */
export const SECTIONS = {
  problem: 'intelligence',
  approach: 'approach',
  routes: 'routes',
  adaptive: 'adaptive',
} as const;
