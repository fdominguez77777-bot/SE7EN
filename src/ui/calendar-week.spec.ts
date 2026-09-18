import { placeTimedEvents } from './calendar-week'

describe('placeTimedEvents', () => {
  it('puts overlapping meetings in separate columns of the same cluster', () => {
    const placed = placeTimedEvents([
      { item: 'a', startMin: 60, endMin: 180 },
      { item: 'b', startMin: 90, endMin: 150 },
      { item: 'c', startMin: 120, endMin: 240 },
    ])
    const byId = Object.fromEntries(placed.map((row) => [row.item, row]))
    expect(byId.a.colCount).toBe(3)
    expect(byId.b.colCount).toBe(3)
    expect(byId.c.colCount).toBe(3)
    expect(new Set([byId.a.col, byId.b.col, byId.c.col]).size).toBe(3)
  })

  it('does not let a wide early meeting cover a later column in the same cluster', () => {
    const placed = placeTimedEvents([
      { item: 'left', startMin: 0, endMin: 120 },
      { item: 'mid', startMin: 60, endMin: 180 },
      { item: 'right', startMin: 90, endMin: 150 },
    ])
    const byId = Object.fromEntries(placed.map((row) => [row.item, row]))
    expect(byId.left.colCount).toBe(3)
    expect(byId.left.span).toBe(1)
    expect(byId.left.col + byId.left.span).toBeLessThanOrEqual(byId.right.col)
  })

  it('lets a later meeting use leftover columns when neighbors have ended', () => {
    const placed = placeTimedEvents([
      { item: 'a', startMin: 0, endMin: 60 },
      { item: 'b', startMin: 0, endMin: 60 },
      { item: 'c', startMin: 30, endMin: 90 },
      { item: 'd', startMin: 70, endMin: 120 },
    ])
    const late = placed.find((row) => row.item === 'd')
    expect(late?.colCount).toBe(3)
    expect(late?.span).toBeGreaterThan(1)
  })

  it('keeps back-to-back meetings in one column', () => {
    const placed = placeTimedEvents([
      { item: 'first', startMin: 0, endMin: 60 },
      { item: 'next', startMin: 60, endMin: 120 },
    ])
    expect(placed.every((row) => row.col === 0 && row.colCount === 1)).toBe(true)
  })
})
