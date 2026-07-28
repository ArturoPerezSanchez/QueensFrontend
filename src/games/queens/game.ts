import type { GameStatus, Position, ViolationKind } from "./types";

export const BOARD_SIZES = [4, 5, 6, 7, 8, 9, 10] as const;

export function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function parsePositionKey(key: string): Position {
  const [row, col] = key.split(":").map(Number);
  return [row, col];
}

function incrementViolation(violations: Record<ViolationKind, number>, kind: ViolationKind): void {
  violations[kind] += 1;
}

function createConflictHints(): Record<ViolationKind, Set<string>> {
  return {
    row: new Set(),
    column: new Set(),
    region: new Set(),
    adjacent: new Set(),
  };
}

function markDuplicateQueens(
  groups: Iterable<string[]>,
  conflicts: Set<string>,
  violations: Record<ViolationKind, number>,
  kind: ViolationKind,
): void {
  for (const positions of groups) {
    if (positions.length > 1) {
      incrementViolation(violations, kind);
      positions.forEach((position) => conflicts.add(position));
    }
  }
}

function addConflictHint(
  board: number[][],
  conflictHints: Record<ViolationKind, Set<string>>,
  kind: ViolationKind,
  first: Position,
  second: Position,
): void {
  const size = board.length;
  const [firstRow, firstCol] = first;
  const [secondRow, secondCol] = second;

  if (kind === "row") {
    for (let col = 0; col < size; col += 1) {
      conflictHints.row.add(positionKey(firstRow, col));
    }
    return;
  }

  if (kind === "column") {
    for (let row = 0; row < size; row += 1) {
      conflictHints.column.add(positionKey(row, firstCol));
    }
    return;
  }

  if (kind === "region") {
    const region = board[firstRow][firstCol];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (board[row][col] === region) {
          conflictHints.region.add(positionKey(row, col));
        }
      }
    }
    return;
  }

  conflictHints.adjacent.add(positionKey(firstRow, firstCol));
  conflictHints.adjacent.add(positionKey(secondRow, secondCol));
}

export function evaluateGame(board: number[][], queens: Set<string>): GameStatus {
  const size = board.length;
  const rows = new Map<number, string[]>();
  const columns = new Map<number, string[]>();
  const regions = new Map<number, string[]>();
  const conflicts = new Set<string>();
  const conflictHints = createConflictHints();
  const violations: Record<ViolationKind, number> = {
    row: 0,
    column: 0,
    region: 0,
    adjacent: 0,
  };

  for (const key of queens) {
    const [row, col] = parsePositionKey(key);
    const region = board[row]?.[col];

    rows.set(row, [...(rows.get(row) ?? []), key]);
    columns.set(col, [...(columns.get(col) ?? []), key]);
    regions.set(region, [...(regions.get(region) ?? []), key]);
  }

  markDuplicateQueens(rows.values(), conflicts, violations, "row");
  markDuplicateQueens(columns.values(), conflicts, violations, "column");
  markDuplicateQueens(regions.values(), conflicts, violations, "region");

  const queenPositions = [...queens].map(parsePositionKey);
  for (let first = 0; first < queenPositions.length; first += 1) {
    for (let second = first + 1; second < queenPositions.length; second += 1) {
      const [firstRow, firstCol] = queenPositions[first];
      const [secondRow, secondCol] = queenPositions[second];
      const areTouching = Math.abs(firstRow - secondRow) <= 1 && Math.abs(firstCol - secondCol) <= 1;
      const reasons: ViolationKind[] = [];

      if (firstRow === secondRow) {
        reasons.push("row");
      }
      if (firstCol === secondCol) {
        reasons.push("column");
      }
      if (board[firstRow][firstCol] === board[secondRow][secondCol]) {
        reasons.push("region");
      }
      if (areTouching) {
        reasons.push("adjacent");
        incrementViolation(violations, "adjacent");
      }

      if (reasons.length > 0) {
        conflicts.add(positionKey(firstRow, firstCol));
        conflicts.add(positionKey(secondRow, secondCol));
        addConflictHint(board, conflictHints, reasons[0], queenPositions[first], queenPositions[second]);
      }
    }
  }

  const hasOnePerRow = rows.size === size && [...rows.values()].every((positions) => positions.length === 1);
  const hasOnePerColumn =
    columns.size === size && [...columns.values()].every((positions) => positions.length === 1);
  const hasOnePerRegion =
    regions.size === size && [...regions.values()].every((positions) => positions.length === 1);
  const hasNoConflicts = conflicts.size === 0;

  return {
    conflictHints,
    conflicts,
    isSolved: queens.size === size && hasOnePerRow && hasOnePerColumn && hasOnePerRegion && hasNoConflicts,
    queenCount: queens.size,
    violations,
  };
}

export function toPositionSet(positions: readonly Position[] | null): Set<string> {
  return new Set((positions ?? []).map(([row, col]) => positionKey(row, col)));
}

export function getForbiddenMarks(board: number[][], queens: Set<string>): Set<string> {
  const marks = new Set<string>();
  const queenPositions = [...queens].map(parsePositionKey);

  for (const [queenRow, queenCol] of queenPositions) {
    const queenRegion = board[queenRow][queenCol];

    for (let index = 0; index < board.length; index += 1) {
      marks.add(positionKey(queenRow, index));
      marks.add(positionKey(index, queenCol));
    }

    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const isSameRegion = board[row][col] === queenRegion;
        const isAdjacent = Math.abs(row - queenRow) <= 1 && Math.abs(col - queenCol) <= 1;

        if (isSameRegion || isAdjacent) {
          marks.add(positionKey(row, col));
        }
      }
    }
  }

  for (const queen of queens) {
    marks.delete(queen);
  }

  return marks;
}
