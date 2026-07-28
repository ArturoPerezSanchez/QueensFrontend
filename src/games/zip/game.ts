import type { Position, Puzzle, StepResult, Wall } from "./types";

export const BOARD_SIZES = [4, 5, 6, 7, 8, 9, 10] as const;

export function positionKey([row, col]: Position): string {
  return `${row}:${col}`;
}

export function samePosition(first: Position, second: Position): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

export function areAdjacent(first: Position, second: Position): boolean {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) === 1;
}

export function edgeKey(first: Position, second: Position): string {
  return [positionKey(first), positionKey(second)].sort().join("|");
}

export function createWallSet(walls: Wall[]): Set<string> {
  return new Set(
    walls.map((wall) => {
      const first: Position = [wall.row, wall.col];
      const second: Position =
        wall.direction === "right"
          ? [wall.row, wall.col + 1]
          : [wall.row + 1, wall.col];
      return edgeKey(first, second);
    }),
  );
}

export function findClue(board: Puzzle["board"], clue: number): Position {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === clue) {
        return [row, col];
      }
    }
  }
  throw new Error(`Puzzle is missing clue ${clue}.`);
}

export function highestClue(board: Puzzle["board"]): number {
  return Math.max(...board.flat().filter((cell): cell is number => cell !== null));
}

export function createInitialPath(puzzle: Puzzle): Position[] {
  return [findClue(puzzle.board, 1)];
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function highestVisitedClue(path: Position[], board: Puzzle["board"]): number {
  return path.reduce((highest, [row, col]) => {
    const clue = board[row][col];
    return clue === null ? highest : Math.max(highest, clue);
  }, 1);
}

export function tryStep(path: Position[], target: Position, puzzle: Puzzle): StepResult {
  const current = path.at(-1);
  if (!current || samePosition(current, target)) {
    return { accepted: true, path, changed: false };
  }

  const visitedIndex = path.findIndex((position) => samePosition(position, target));
  if (visitedIndex >= 0) {
    return { accepted: true, path: path.slice(0, visitedIndex + 1), changed: true };
  }

  if (!areAdjacent(current, target)) {
    return {
      accepted: false,
      path,
      error: { kind: "not-adjacent", target },
    };
  }

  if (createWallSet(puzzle.walls).has(edgeKey(current, target))) {
    return {
      accepted: false,
      path,
      error: { kind: "wall", target },
    };
  }

  const [row, col] = target;
  const targetClue = puzzle.board[row][col];
  const expectedClue = highestVisitedClue(path, puzzle.board) + 1;
  if (targetClue !== null && targetClue !== expectedClue) {
    return {
      accepted: false,
      path,
      error: {
        kind: "clue-order",
        target,
        expectedClue,
        actualClue: targetClue,
      },
    };
  }

  const lastClue = highestClue(puzzle.board);
  if (
    targetClue === lastClue &&
    path.length + 1 < puzzle.size * puzzle.size
  ) {
    return {
      accepted: false,
      path,
      error: {
        kind: "finish-too-soon",
        target,
        actualClue: targetClue,
      },
    };
  }

  return { accepted: true, path: [...path, target], changed: true };
}

export function isSolved(path: Position[], puzzle: Puzzle): boolean {
  if (path.length !== puzzle.size * puzzle.size) {
    return false;
  }

  const last = path.at(-1);
  if (!last) {
    return false;
  }

  return puzzle.board[last[0]][last[1]] === highestClue(puzzle.board);
}

export function solutionPrefixWithHint(path: Position[], solution: Position[]): Position[] {
  let matchingLength = 0;
  while (
    matchingLength < path.length &&
    matchingLength < solution.length &&
    samePosition(path[matchingLength], solution[matchingLength])
  ) {
    matchingLength += 1;
  }

  const nextLength = Math.min(solution.length, Math.max(1, matchingLength) + 1);
  return solution.slice(0, nextLength);
}

export function pathPoints(path: Position[]): string {
  return path.map(([row, col]) => `${col + 0.5},${row + 0.5}`).join(" ");
}
