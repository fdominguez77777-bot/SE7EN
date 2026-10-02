/**
 * Split Second: a hand sweeps the dial. Strike while it is inside the gold arc. Every hit
 * reverses the hand (mostly), speeds it up and shrinks the arc. Strike outside it, or let the
 * hand sweep past, and the run ends.
 */

export const BEST_KEY = 'se7en-split-second-best'

/** Degrees per second. */
export function speedFor(score: number) {
  return Math.min(600, 150 + score * 13)
}

/** Arc width in degrees. */
export function widthFor(score: number) {
  return Math.max(7, 38 - score * 1.4)
}

/** Fraction of the arc, around its middle, that counts as a perfect strike. */
export const PERFECT_SHARE = 0.3

/** Forgiveness on each edge, in degrees, for input and frame timing. */
export const EDGE_GRACE = 1.5

export type Strike = 'perfect' | 'hit' | 'miss'

/** `remaining` is how far (in degrees, along the direction of travel) the hand is from the arc's middle. */
export function judge(remaining: number, width: number): Strike {
  const off = Math.abs(remaining)
  if (off <= (width * PERFECT_SHARE) / 2) return 'perfect'
  if (off <= width / 2 + EDGE_GRACE) return 'hit'
  return 'miss'
}

/** True once the hand has fully swept past the arc. */
export function sweptPast(remaining: number, width: number) {
  return remaining < -(width / 2 + EDGE_GRACE)
}

/**
 * Where the next arc goes and which way the hand turns. Early on the hand always reverses;
 * later it sometimes keeps going so you can't run on rhythm alone.
 */
export function nextTarget(score: number, random = Math.random) {
  const keepDirection = score >= 8 && random() < Math.min(0.4, (score - 6) * 0.03)
  const ahead = 70 + random() * (score >= 12 ? 250 : 200)
  return { flip: !keepDirection, ahead }
}

export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360
}
