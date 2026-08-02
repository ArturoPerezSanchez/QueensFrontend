import { apiPath } from "@/shared/api";
import { mineCount, validateClues } from "./game";
import type { Board, MineIslandsResponse, Puzzle } from "./types";

function isSolutionBoard(value: unknown, size: number, mineTotal: number): value is Board {
  return (
    Array.isArray(value) &&
    value.length === size &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === size &&
        row.every((cell) => Number.isInteger(cell) && cell >= -1 && cell <= 8),
    ) &&
    mineCount(value as Board) === mineTotal &&
    validateClues(value as Board, mineTotal)
  );
}

export async function fetchPuzzle(size: number, signal?: AbortSignal): Promise<Puzzle> {
  const params = new URLSearchParams({
    board_size: String(size),
    solution: "true",
  });
  const response = await fetch(`${apiPath("/mine-islands")}?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Puzzle generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as MineIslandsResponse;
  if (
    payload.board_size !== size ||
    !Number.isInteger(payload.mine_count) ||
    payload.mine_count <= 0 ||
    !isSolutionBoard(payload.solution, size, payload.mine_count)
  ) {
    throw new Error("The API returned an invalid Mine Islands puzzle.");
  }

  return {
    size,
    mineCount: payload.mine_count,
    solution: payload.solution,
  };
}
