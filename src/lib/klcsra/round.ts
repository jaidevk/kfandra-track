/**
 * League points are fractional (0.2 / 0.1 draws, 0.5 wins), so sums pick up
 * binary-float noise: 0.2 + 0.1 is 0.30000000000000004. Four decimal places
 * is far more precision than any configured rule uses, and it renders
 * cleanly.
 */
export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
