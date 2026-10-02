import { NORTH, SOUTH, EAST, WEST, isSolved, litTiles, makeBoard, masksFor, neighbor, opposite, rotateMask } from './connect-team'

function edgeCount(masks: number[]) {
  return masks.reduce((sum, mask) => sum + [NORTH, EAST, SOUTH, WEST].filter((side) => mask & side).length, 0) / 2
}

describe('connect the team', () => {
  it('rotates masks clockwise', () => {
    expect(rotateMask(NORTH, 1)).toBe(EAST)
    expect(rotateMask(NORTH | EAST, 1)).toBe(EAST | SOUTH)
    expect(rotateMask(WEST, 1)).toBe(NORTH)
    expect(rotateMask(NORTH, -1)).toBe(WEST)
    expect(opposite(EAST)).toBe(WEST)
  })

  it('builds scrambled boards that come from a spanning tree', () => {
    for (const [cols, rows] of [
      [5, 4],
      [7, 5],
      [9, 6],
    ]) {
      for (let run = 0; run < 40; run += 1) {
        const board = makeBoard(cols, rows)
        expect(board.base).toHaveLength(cols * rows)
        expect(edgeCount(board.base)).toBe(cols * rows - 1)
        expect(board.base.every((mask) => mask > 0)).toBe(true)
        expect(isSolved(board, board.base)).toBe(false)
      }
    }
  })

  it('recognises a solved board and lights every tile', () => {
    const board = { cols: 2, rows: 1, hub: 0, base: [EAST, WEST] }
    expect(isSolved(board, masksFor(board, [0, 0]))).toBe(true)
    expect(litTiles(board, board.base).size).toBe(2)
    expect(isSolved(board, masksFor(board, [1, 0]))).toBe(false)
    expect(neighbor(0, NORTH, 2, 1)).toBe(-1)
  })
})
