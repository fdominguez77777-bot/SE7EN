/**
 * Hands of Time: stones sit around the dial, each with a step value. Standing on a stone, the two
 * hands point that many steps clockwise and counter-clockwise; jump to either. Clear every stone.
 */

export function stoneCount(level: number) {
  return Math.min(12, 4 + level)
}

export function jumpTargets(index: number, values: number[]) {
  const size = values.length
  const step = values[index]
  const forward = (index + step) % size
  const back = (((index - step) % size) + size) % size
  return forward === back ? [forward] : [forward, back]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

/** Finds a way to clear the remaining stones from `current`, or null when there is none. */
export function solveFrom(current: number, used: Set<number>, values: number[]): number[] | null {
  if (used.size === values.length) return []
  for (const next of jumpTargets(current, values)) {
    if (used.has(next)) continue
    used.add(next)
    const rest = solveFrom(next, used, values)
    used.delete(next)
    if (rest) return [next, ...rest]
  }
  return null
}

function countSolutions(values: number[], cap: number) {
  let found = 0
  const used = new Set<number>()
  const walk = (current: number) => {
    if (found >= cap) return
    if (used.size === values.length) {
      found += 1
      return
    }
    for (const next of jumpTargets(current, values)) {
      if (used.has(next)) continue
      used.add(next)
      walk(next)
      used.delete(next)
    }
  }
  for (let start = 0; start < values.length && found < cap; start += 1) {
    used.add(start)
    walk(start)
    used.delete(start)
  }
  return found
}

/** Builds a dial from a hidden route so every puzzle is solvable. */
function fromRoute(size: number) {
  const route = shuffle(Array.from({ length: size }, (_, index) => index))
  const half = Math.floor(size / 2)
  const values = Array.from({ length: size }, () => 1 + Math.floor(Math.random() * half))
  for (let step = 0; step < size - 1; step += 1) {
    const from = route[step]
    const to = route[step + 1]
    const distance = (((to - from) % size) + size) % size
    values[from] = Math.min(distance, size - distance)
  }
  return values
}

/** Later levels keep the candidate with the fewest routes, so they need more planning. */
export function makeDial(level: number) {
  const size = stoneCount(level)
  const tries = level <= 2 ? 1 : Math.min(16, 2 + level * 2)
  let best = fromRoute(size)
  let bestCount = countSolutions(best, 60)
  for (let attempt = 1; attempt < tries; attempt += 1) {
    const candidate = fromRoute(size)
    const count = countSolutions(candidate, 60)
    if (count > 0 && count < bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/** Next stone to tap: a winning start, a winning jump, or null when the current route is a dead end. */
export function hintFor(path: number[], values: number[]) {
  if (path.length === 0) {
    for (let start = 0; start < values.length; start += 1) {
      if (solveFrom(start, new Set([start]), values)) return start
    }
    return null
  }
  const used = new Set(path)
  const current = path[path.length - 1]
  for (const next of jumpTargets(current, values)) {
    if (used.has(next)) continue
    used.add(next)
    const works = solveFrom(next, used, values)
    used.delete(next)
    if (works) return next
  }
  return null
}
