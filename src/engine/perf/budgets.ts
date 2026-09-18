/**
 * Performance budgets (PERFORMANCE §2, HU-GAME-071 RN-2). Pure: the dev overlay colors each metric with
 * `grade`, and tests pin the thresholds.
 */
export type Grade = 'ok' | 'warning' | 'critical';

export type Metric =
  | 'uiFps'
  | 'jsFps'
  | 'dropResponseMs'
  | 'textureMb'
  | 'renderedEntities'
  | 'loadedEntities'
  | 'transitionMs'
  | 'flushMs';

/** [warning, critical]; `higherIsBetter` metrics degrade downwards (FPS). */
export const BUDGETS: Record<Metric, { warning: number; critical: number; higherIsBetter?: boolean }> = {
  uiFps: { warning: 55, critical: 45, higherIsBetter: true },
  jsFps: { warning: 40, critical: 25, higherIsBetter: true },
  dropResponseMs: { warning: 100, critical: 200 },
  textureMb: { warning: 200, critical: 280 },
  renderedEntities: { warning: 180, critical: 250 },
  loadedEntities: { warning: 450, critical: 600 },
  transitionMs: { warning: 1500, critical: 2500 },
  flushMs: { warning: 50, critical: 100 },
};

export function grade(metric: Metric, value: number): Grade {
  const b = BUDGETS[metric];
  if (b.higherIsBetter) return value < b.critical ? 'critical' : value < b.warning ? 'warning' : 'ok';
  return value > b.critical ? 'critical' : value > b.warning ? 'warning' : 'ok';
}
