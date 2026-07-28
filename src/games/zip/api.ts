import {
  areAdjacent,
  createWallSet,
  edgeKey,
  highestClue,
  positionKey,
} from "./game";
import type { Position, Puzzle, Wall, ZipResponse } from "./types";

function isBoard(value: unknown, size: number): value is Puzzle["board"] {
  if (
    !Array.isArray(value) ||
    value.length !== size ||
    !value.every((row) => Array.isArray(row) && row.length === size)
  ) {
    return false;
  }

  const cells = value.flat();
  if (!cells.every((cell) => cell === null || (Number.isInteger(cell) && Number(cell) > 0))) {
    return false;
  }

  const clues = cells.filter((cell): cell is number => typeof cell === "number").sort((a, b) => a - b);
  return (
    clues.length >= 2 &&
    clues.every((clue, index) => clue === index + 1)
  );
}

function isWall(value: unknown, size: number): value is Wall {
  if (!value || typeof value !== "object") {
    return false;
  }

  const wall = value as Partial<Wall>;
  return (
    Number.isInteger(wall.row) &&
    Number.isInteger(wall.col) &&
    Number(wall.row) >= 0 &&
    Number(wall.col) >= 0 &&
    (wall.direction === "right" || wall.direction === "down") &&
    (wall.direction === "right" ? Number(wall.col) < size - 1 : Number(wall.row) < size - 1)
  );
}

function isSolution(
  value: unknown,
  size: number,
  board: Puzzle["board"],
  walls: Wall[],
): value is Array<[number, number]> {
  if (!Array.isArray(value) || value.length !== size * size) {
    return false;
  }

  const positions: Position[] = [];
  for (const position of value) {
    if (
      !Array.isArray(position) ||
      position.length !== 2 ||
      !Number.isInteger(position[0]) ||
      !Number.isInteger(position[1]) ||
      position[0] < 0 ||
      position[1] < 0 ||
      position[0] >= size ||
      position[1] >= size
    ) {
      return false;
    }
    positions.push([position[0], position[1]]);
  }

  if (new Set(positions.map(positionKey)).size !== positions.length) {
    return false;
  }

  const wallSet = createWallSet(walls);
  for (let index = 1; index < positions.length; index += 1) {
    if (
      !areAdjacent(positions[index - 1], positions[index]) ||
      wallSet.has(edgeKey(positions[index - 1], positions[index]))
    ) {
      return false;
    }
  }

  const encounteredClues = positions
    .map(([row, col]) => board[row][col])
    .filter((cell): cell is number => cell !== null);

  return (
    board[positions[0][0]][positions[0][1]] === 1 &&
    board[positions.at(-1)![0]][positions.at(-1)![1]] === highestClue(board) &&
    encounteredClues.every((clue, index) => clue === index + 1)
  );
}

export async function fetchPuzzle(size: number, signal?: AbortSignal): Promise<Puzzle> {
  const params = new URLSearchParams({
    board_size: String(size),
    solution: "true",
  });
  const response = await fetch(`/api/zip?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Puzzle generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ZipResponse;
  if (
    payload.board_size !== size ||
    !isBoard(payload.board, size) ||
    !Array.isArray(payload.walls) ||
    !payload.walls.every((wall) => isWall(wall, size)) ||
    !isSolution(payload.solution, size, payload.board, payload.walls)
  ) {
    throw new Error("The API returned an invalid Zip puzzle.");
  }

  return {
    size,
    board: payload.board,
    walls: payload.walls,
    solution: payload.solution,
  };
}

