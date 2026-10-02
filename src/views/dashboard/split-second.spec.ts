import { EDGE_GRACE, judge, nextTarget, speedFor, sweptPast, widthFor } from './split-second'

describe('split second', () => {
  it('gets faster and tighter with every hit, within limits', () => {
    for (let hits = 1; hits < 60; hits += 1) {
      expect(speedFor(hits)).toBeGreaterThanOrEqual(speedFor(hits - 1))
      expect(widthFor(hits)).toBeLessThanOrEqual(widthFor(hits - 1))
    }
    expect(speedFor(1000)).toBe(600)
    expect(widthFor(1000)).toBe(7)
  })

  it('judges strikes by distance from the middle of the arc', () => {
    expect(judge(0, 20)).toBe('perfect')
    expect(judge(-2.9, 20)).toBe('perfect')
    expect(judge(8, 20)).toBe('hit')
    expect(judge(-10 - EDGE_GRACE, 20)).toBe('hit')
    expect(judge(12, 20)).toBe('miss')
    expect(judge(-12, 20)).toBe('miss')
  })

  it('only ends the run once the hand has fully passed the arc', () => {
    expect(sweptPast(-10, 20)).toBe(false)
    expect(sweptPast(-10 - EDGE_GRACE - 0.1, 20)).toBe(true)
    expect(sweptPast(50, 20)).toBe(false)
  })

  it('always reverses early on and places the next arc well ahead', () => {
    expect(nextTarget(3, () => 0)).toEqual({ flip: true, ahead: 70 })
    expect(nextTarget(20, () => 0).flip).toBe(false)
    expect(nextTarget(20, () => 0.99).flip).toBe(true)
    expect(nextTarget(20, () => 0.99).ahead).toBeLessThanOrEqual(320)
  })
})
