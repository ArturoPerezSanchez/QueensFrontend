import { apiPath } from "@/shared/api";
import type { Puzzle, QueensResponse } from "./types";

const API_PATH = apiPath("/queens");

function assertBoard(board: number[][], size: number): void {
  if (board.length !== size || board.some((row) => row.length !== size)) {
    throw new Error("The API returned a board with an unexpected shape.");
  }
}

/**
 * Loads a uniquely solvable Queens puzzle from the backend.
 *
 * The app asks for the solution so it can offer an optional reveal button.
 * Normal solve detection is still based on the visible game rules.
 */
export async function fetchPuzzle(size: number, signal?: AbortSignal): Promise<Puzzle> {
  const params = new URLSearchParams({
    board_size: String(size),
    solution: "true",
  });

  const response = await fetch(`${API_PATH}?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Puzzle generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as QueensResponse;
  assertBoard(payload.board, size);

  return {
    board: payload.board,
    solution: payload.solution,
    size,
  };
}
