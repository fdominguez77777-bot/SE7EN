import { hintFor, jumpTargets, makeDial, solveFrom, stoneCount } from './hands-of-time'

function solvable(values: number[]) {
  return values.some((_, start) => solveFrom(start, new Set([start]), values) !== null)
}

describe('hands of time', () => {
  it('always builds a solvable dial of the right size', () => {
    for (let level = 1; level <= 12; level += 1) {
      for (let run = 0; run < 60; run += 1) {
        const values = makeDial(level)
        expect(values).toHaveLength(stoneCount(level))
        expect(values.every((value) => value >= 1 && value <= Math.floor(values.length / 2))).toBe(true)
        expect(solvable(values)).toBe(true)
      }
    }
  })

  it('following hints clears the whole dial', () => {
    for (let run = 0; run < 40; run += 1) {
      const values = makeDial(8)
      const path: number[] = []
      while (path.length < values.length) {
        const next = hintFor(path, values)
        expect(next).not.toBeNull()
        if (path.length) expect(jumpTargets(path[path.length - 1], values)).toContain(next)
        path.push(next as number)
      }
      expect(new Set(path).size).toBe(values.length)
    }
  })

  it('reports a dead end when no route remains', () => {
    expect(hintFor([0, 1, 2, 3, 4], [1, 1, 1, 1, 1])).toBeNull()
    expect(hintFor([2, 1, 0], [1, 1, 1, 1, 1])).toBe(4)
    expect(hintFor([0, 2], [2, 2, 2, 2])).toBeNull()
  })
})
