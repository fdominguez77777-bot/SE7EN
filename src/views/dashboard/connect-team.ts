/** Pipe directions as bit flags; a tile's mask lists the sides its pipe reaches. */
export const NORTH = 1
export const EAST = 2
export const SOUTH = 4
export const WEST = 8

const SIDES = [NORTH, EAST, SOUTH, WEST] as const

export type Board = {
  cols: number
  rows: number
  hub: number
  /** Scrambled starting masks; the shown mask is this rotated by the tile's turns. */
  base: number[]
}

export function opposite(side: number) {
  return side === NORTH ? SOUTH : side === EAST ? WEST : side === SOUTH ? NORTH : EAST
}

export function rotateMask(mask: number, turns: number) {
  let next = mask
  const steps = ((turns % 4) + 4) % 4
  for (let step = 0; step < steps; step += 1) {
    next = ((next << 1) | (next >> 3)) & 15
  }
  return next
}

export function neighbor(index: number, side: number, cols: number, rows: number) {
  const col = index % cols
  const row = Math.floor(index / cols)
  if (side === NORTH) return row > 0 ? index - cols : -1
  if (side === SOUTH) return row < rows - 1 ? index + cols : -1
  if (side === EAST) return col < cols - 1 ? index + 1 : -1
  return col > 0 ? index - 1 : -1
}

export function sideCount(mask: number) {
  return SIDES.filter((side) => mask & side).length
}

/** Random spanning tree grown from the hub (randomized Prim), so the solved board has no loops. */
function spanningTree(cols: number, rows: number, hub: number) {
  const masks = new Array<number>(cols * rows).fill(0)
  const inTree = new Set<number>([hub])
  const frontier: Array<{ from: number; side: number }> = []
  const addFrontier = (cell: number) => {
    for (const side of SIDES) {
      const next = neighbor(cell, side, cols, rows)
      if (next >= 0 && !inTree.has(next)) frontier.push({ from: cell, side })
    }
  }
  addFrontier(hub)
  while (frontier.length) {
    const pick = Math.floor(Math.random() * frontier.length)
    const { from, side } = frontier.splice(pick, 1)[0]
    const to = neighbor(from, side, cols, rows)
    if (inTree.has(to)) continue
    masks[from] |= side
    masks[to] |= opposite(side)
    inTree.add(to)
    addFrontier(to)
  }
  return masks
}

/** Tiles reachable from the hub through pipes that meet on both sides. */
export function litTiles(board: Board, masks: number[]) {
  const lit = new Set<number>([board.hub])
  const queue = [board.hub]
  while (queue.length) {
    const cell = queue.shift() as number
    for (const side of SIDES) {
      if (!(masks[cell] & side)) continue
      const next = neighbor(cell, side, board.cols, board.rows)
      if (next < 0 || lit.has(next) || !(masks[next] & opposite(side))) continue
      lit.add(next)
      queue.push(next)
    }
  }
  return lit
}

/** Solved when every tile is lit and no pipe end points at a wall or an unmatched side. */
export function isSolved(board: Board, masks: number[]) {
  for (let cell = 0; cell < masks.length; cell += 1) {
    for (const side of SIDES) {
      if (!(masks[cell] & side)) continue
      const next = neighbor(cell, side, board.cols, board.rows)
      if (next < 0 || !(masks[next] & opposite(side))) return false
    }
  }
  return litTiles(board, masks).size === masks.length
}

export function makeBoard(cols: number, rows: number): Board {
  const hub = Math.floor(rows / 2) * cols + Math.floor(cols / 2)
  const solution = spanningTree(cols, rows, hub)
  const board: Board = { cols, rows, hub, base: solution }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const base = solution.map((mask) => rotateMask(mask, Math.floor(Math.random() * 4)))
    board.base = base
    if (!isSolved(board, base)) return board
  }
  return board
}

export function masksFor(board: Board, turns: number[]) {
  return board.base.map((mask, index) => rotateMask(mask, turns[index] ?? 0))
}
