import type { Board, Position, RevealResult, VisibilityBoard } from "./types";

export const BOARD_SIZES = [6, 7, 8, 9, 10] as const;
export const MINE = -1;

export function positionKey([row, col]: Position): string {
  return `${row}:${col}`;
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function neighbors(row: number, col: number, size: number): Position[] {
  const cells: Position[] = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) {
        continue;
      }
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (nextRow >= 0 && nextCol >= 0 && nextRow < size && nextCol < size) {
        cells.push([nextRow, nextCol]);
      }
    }
  }
  return cells;
}

export function createHiddenBoard(size: number): VisibilityBoard {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => "hidden"));
}

export function cloneVisibility(visibility: VisibilityBoard): VisibilityBoard {
  return visibility.map((row) => [...row]);
}

export function mineCount(board: Board): number {
  return board.flat().filter((cell) => cell === MINE).length;
}

export function safeCount(board: Board): number {
  return board.length * board.length - mineCount(board);
}

export function revealedSafeCount(board: Board, visibility: VisibilityBoard): number {
  let revealed = 0;
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] !== MINE && visibility[row][col] === "revealed") {
        revealed += 1;
      }
    }
  }
  return revealed;
}

export function flagCount(visibility: VisibilityBoard): number {
  return visibility.flat().filter((cell) => cell === "flagged").length;
}

export function isSolved(board: Board, visibility: VisibilityBoard): boolean {
  return board.length > 0 && revealedSafeCount(board, visibility) === safeCount(board);
}

export function validateClues(board: Board, expectedMineCount?: number): boolean {
  const size = board.length;
  if (size === 0 || board.some((row) => row.length !== size)) {
    return false;
  }

  const mines = new Set(
    board
      .flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => (cell === MINE ? positionKey([rowIndex, colIndex]) : null)),
      )
      .filter((key): key is string => key !== null),
  );

  if (expectedMineCount !== undefined && mines.size !== expectedMineCount) {
    return false;
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = board[row][col];
      if (cell === MINE) {
        continue;
      }
      const clue = neighbors(row, col, size).filter((position) => mines.has(positionKey(position))).length;
      if (cell !== clue) {
        return false;
      }
    }
  }

  return true;
}

export function revealCell(board: Board, visibility: VisibilityBoard, row: number, col: number): RevealResult {
  if (visibility[row][col] === "revealed" || visibility[row][col] === "flagged") {
    return { visibility, hitMine: false, changed: false };
  }

  const next = cloneVisibility(visibility);
  if (board[row][col] === MINE) {
    next[row][col] = "revealed";
    return { visibility: next, hitMine: true, changed: true };
  }

  const queue: Position[] = [[row, col]];
  const seen = new Set<string>();
  while (queue.length) {
    const [currentRow, currentCol] = queue.shift()!;
    const key = positionKey([currentRow, currentCol]);
    if (seen.has(key) || next[currentRow][currentCol] === "flagged") {
      continue;
    }
    seen.add(key);
    next[currentRow][currentCol] = "revealed";

    if (board[currentRow][currentCol] !== 0) {
      continue;
    }

    for (const neighbor of neighbors(currentRow, currentCol, board.length)) {
      const [neighborRow, neighborCol] = neighbor;
      if (board[neighborRow][neighborCol] !== MINE && next[neighborRow][neighborCol] !== "revealed") {
        queue.push(neighbor);
      }
    }
  }

  return { visibility: next, hitMine: false, changed: true };
}

export function toggleFlag(visibility: VisibilityBoard, row: number, col: number): VisibilityBoard {
  if (visibility[row][col] === "revealed") {
    return visibility;
  }
  const next = cloneVisibility(visibility);
  next[row][col] = next[row][col] === "flagged" ? "hidden" : "flagged";
  return next;
}

export function revealAll(visibility: VisibilityBoard): VisibilityBoard {
  return visibility.map((row) => row.map(() => "revealed"));
}

export function hintCell(board: Board, visibility: VisibilityBoard): Position | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === 0 && visibility[row][col] === "hidden") {
        return [row, col];
      }
    }
  }

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] !== MINE && visibility[row][col] === "hidden") {
        return [row, col];
      }
    }
  }

  return null;
}
