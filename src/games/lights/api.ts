import { solvesBoard } from "./game";
import type { Board, LightsResponse, Position, Puzzle } from "./types";

function isBoard(value: unknown, size: number): value is Board {
  return (
    Array.isArray(value) &&
    value.length === size &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === size &&
        row.every((cell) => cell === 0 || cell === 1),
    )
  );
}

function isPosition(value: unknown, size: number): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] >= 0 &&
    value[1] >= 0 &&
    value[0] < size &&
    value[1] < size
  );
}

export async function fetchPuzzle(size: number, signal?: AbortSignal): Promise<Puzzle> {
  const params = new URLSearchParams({
    board_size: String(size),
    solution: "true",
  });
  const response = await fetch(`/api/lights?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Puzzle generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as LightsResponse;
  if (
    payload.board_size !== size ||
    !isBoard(payload.board, size) ||
    !Array.isArray(payload.solution) ||
    !payload.solution.every((position) => isPosition(position, size)) ||
    !solvesBoard(payload.board, payload.solution as Position[])
  ) {
    throw new Error("The API returned an invalid Lights puzzle.");
  }

  return {
    size,
    board: payload.board,
    solution: payload.solution,
  };
}
