import type { Board, Position } from "./types";

export const BOARD_SIZES = [4, 5, 6, 7, 8] as const;

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

export function affectedCells(row: number, col: number, size: number): Position[] {
  return [
    [row, col],
    ...(row > 0 ? ([[row - 1, col]] as Position[]) : []),
    ...(col > 0 ? ([[row, col - 1]] as Position[]) : []),
    ...(col < size - 1 ? ([[row, col + 1]] as Position[]) : []),
    ...(row < size - 1 ? ([[row + 1, col]] as Position[]) : []),
  ];
}

export function pressCell(board: Board, row: number, col: number): Board {
  const next = cloneBoard(board);
  for (const [cellRow, cellCol] of affectedCells(row, col, board.length)) {
    next[cellRow][cellCol] = next[cellRow][cellCol] === 1 ? 0 : 1;
  }
  return next;
}

export function litCount(board: Board): number {
  return board.reduce((total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell, 0), 0);
}

export function isSolved(board: Board): boolean {
  return litCount(board) === board.length * board.length;
}

export function solvesBoard(board: Board, presses: Position[]): boolean {
  return isSolved(presses.reduce((current, [row, col]) => pressCell(current, row, col), board));
}

export function solveBoard(board: Board): Position[] | null {
  const size = board.length;
  const total = size * size;
  const matrix = Array.from({ length: total }, (_, cellIndex) => {
    const row = Math.floor(cellIndex / size);
    const col = cellIndex % size;
    const values = Array(total + 1).fill(0) as number[];

    for (let pressRow = 0; pressRow < size; pressRow += 1) {
      for (let pressCol = 0; pressCol < size; pressCol += 1) {
        if (affectedCells(pressRow, pressCol, size).some(([r, c]) => r === row && c === col)) {
          values[pressRow * size + pressCol] = 1;
        }
      }
    }

    values[total] = board[row][col] === 1 ? 0 : 1;
    return values;
  });

  const pivotForColumn = Array<number | null>(total).fill(null);
  let pivotRow = 0;

  for (let col = 0; col < total && pivotRow < total; col += 1) {
    const selected = matrix.findIndex((row, index) => index >= pivotRow && row[col] === 1);
    if (selected < 0) {
      continue;
    }

    [matrix[pivotRow], matrix[selected]] = [matrix[selected], matrix[pivotRow]];
    for (let row = 0; row < total; row += 1) {
      if (row !== pivotRow && matrix[row][col] === 1) {
        for (let c = col; c <= total; c += 1) {
          matrix[row][c] ^= matrix[pivotRow][c];
        }
      }
    }

    pivotForColumn[col] = pivotRow;
    pivotRow += 1;
  }

  if (matrix.some((row) => row.slice(0, total).every((value) => value === 0) && row[total] === 1)) {
    return null;
  }

  const solution = Array(total).fill(0) as number[];
  for (let col = 0; col < total; col += 1) {
    const row = pivotForColumn[col];
    if (row !== null) {
      solution[col] = matrix[row][total];
    }
  }

  return solution
    .map((value, index) => (value ? ([Math.floor(index / size), index % size] as Position) : null))
    .filter((position): position is Position => position !== null);
}
