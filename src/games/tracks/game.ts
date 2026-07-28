import type { Board, Position, Puzzle } from "./types";

export const BOARD_SIZES = [6, 7, 8, 9] as const;
export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;
export const NORTH_EAST = 16;
export const SOUTH_EAST = 32;
export const SOUTH_WEST = 64;
export const NORTH_WEST = 128;
export const DIRECTIONS = [NORTH, NORTH_EAST, EAST, SOUTH_EAST, SOUTH, SOUTH_WEST, WEST, NORTH_WEST] as const;
export const DIRECTION_DELTAS: Record<number, Position> = {
  [NORTH]: [-1, 0],
  [NORTH_EAST]: [-1, 1],
  [EAST]: [0, 1],
  [SOUTH_EAST]: [1, 1],
  [SOUTH]: [1, 0],
  [SOUTH_WEST]: [1, -1],
  [WEST]: [0, -1],
  [NORTH_WEST]: [-1, -1],
};
export const OPPOSITE_DIRECTIONS: Record<number, number> = {
  [NORTH]: SOUTH,
  [NORTH_EAST]: SOUTH_WEST,
  [EAST]: WEST,
  [SOUTH_EAST]: NORTH_WEST,
  [SOUTH]: NORTH,
  [SOUTH_WEST]: NORTH_EAST,
  [WEST]: EAST,
  [NORTH_WEST]: SOUTH_EAST,
};

export function positionKey([row, col]: Position): string {
  return `${row}:${col}`;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function rotateMask(mask: number, turns = 1): number {
  let next = mask;
  for (let index = 0; index < turns % 8; index += 1) {
    let rotated = 0;
    if (next & NORTH) {
      rotated |= NORTH_EAST;
    }
    if (next & NORTH_EAST) {
      rotated |= EAST;
    }
    if (next & EAST) {
      rotated |= SOUTH_EAST;
    }
    if (next & SOUTH_EAST) {
      rotated |= SOUTH;
    }
    if (next & SOUTH) {
      rotated |= SOUTH_WEST;
    }
    if (next & SOUTH_WEST) {
      rotated |= WEST;
    }
    if (next & WEST) {
      rotated |= NORTH_WEST;
    }
    if (next & NORTH_WEST) {
      rotated |= NORTH;
    }
    next = rotated;
  }
  return next;
}

export function rotateCell(board: Board, row: number, col: number): Board {
  const next = cloneBoard(board);
  next[row][col] = rotateMask(next[row][col]);
  return next;
}

export function trackCount(board: Board): number {
  return board.flat().filter((mask) => mask !== 0).length;
}

export function alignedCount(board: Board, solution: Board): number {
  let aligned = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (solution[row][col] !== 0 && board[row][col] === solution[row][col]) {
        aligned += 1;
      }
    }
  }
  return aligned;
}

export function connectedTrackKeys(board: Board, start: Position): Set<string> {
  const size = board.length;
  const connected = new Set<string>();
  if (
    size === 0 ||
    start[0] < 0 ||
    start[1] < 0 ||
    start[0] >= size ||
    start[1] >= size ||
    board[start[0]][start[1]] === 0
  ) {
    return connected;
  }

  const stack: Position[] = [start];
  while (stack.length) {
    const current = stack.pop()!;
    const key = positionKey(current);
    if (connected.has(key)) {
      continue;
    }
    connected.add(key);

    const mask = board[current[0]][current[1]];
    for (const direction of DIRECTIONS) {
      if (!(mask & direction)) {
        continue;
      }

      const [dr, dc] = DIRECTION_DELTAS[direction];
      const neighbor: Position = [current[0] + dr, current[1] + dc];
      if (
        neighbor[0] < 0 ||
        neighbor[1] < 0 ||
        neighbor[0] >= size ||
        neighbor[1] >= size
      ) {
        continue;
      }

      const neighborMask = board[neighbor[0]][neighbor[1]];
      if (neighborMask & OPPOSITE_DIRECTIONS[direction]) {
        stack.push(neighbor);
      }
    }
  }

  return connected;
}

export function isSolved(board: Board, puzzle: Puzzle): boolean {
  return alignedCount(board, puzzle.solution) === trackCount(puzzle.solution);
}

export function nextHintCell(board: Board, solution: Board): Position | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (solution[row][col] !== 0 && board[row][col] !== solution[row][col]) {
        return [row, col];
      }
    }
  }
  return null;
}

export function applyHint(board: Board, solution: Board): Board {
  const hint = nextHintCell(board, solution);
  if (!hint) {
    return board;
  }
  const next = cloneBoard(board);
  next[hint[0]][hint[1]] = solution[hint[0]][hint[1]];
  return next;
}

export function isValidMask(mask: number): boolean {
  return Number.isInteger(mask) && mask >= 0 && mask <= 255;
}

export function isConnectedSolution(solution: Board, start: Position, end: Position): boolean {
  const size = solution.length;
  const startKey = positionKey(start);
  const endKey = positionKey(end);
  const trackCells = new Set<string>();

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (solution[row][col] !== 0) {
        trackCells.add(positionKey([row, col]));
      }
    }
  }

  if (!trackCells.has(startKey) || !trackCells.has(endKey)) {
    return false;
  }

  const seen = new Set<string>();
  const stack: Position[] = [start];
  while (stack.length) {
    const current = stack.pop()!;
    const key = positionKey(current);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const mask = solution[current[0]][current[1]];
    for (const direction of DIRECTIONS) {
      if (!(mask & direction)) {
        continue;
      }
      const [dr, dc] = DIRECTION_DELTAS[direction];
      const neighbor: Position = [current[0] + dr, current[1] + dc];
      if (
        neighbor[0] < 0 ||
        neighbor[1] < 0 ||
        neighbor[0] >= size ||
        neighbor[1] >= size ||
        !(solution[neighbor[0]][neighbor[1]] & OPPOSITE_DIRECTIONS[direction])
      ) {
        return false;
      }
      stack.push(neighbor);
    }
  }

  return seen.size === trackCells.size && seen.has(endKey);
}
