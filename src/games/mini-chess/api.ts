import type { MiniChessResponse, Puzzle, SolutionMove } from "./types";

const API_PATH = "/api/mini-chess";

function assertSolution(
  mateIn: number,
  solution: SolutionMove[] | null,
  stateCount: number,
  finalIsMate: boolean,
): asserts solution is SolutionMove[] {
  if (!solution || solution.length !== mateIn * 2 - 1) {
    throw new Error("The API returned an incomplete MiniChess solution.");
  }
  if (stateCount !== solution.length + 1 || !finalIsMate) {
    throw new Error("The MiniChess solution does not end in checkmate.");
  }
}

export async function fetchPuzzle(signal?: AbortSignal): Promise<Puzzle> {
  const params = new URLSearchParams({
    solution: "true",
  });
  const response = await fetch(`${API_PATH}?${params}`, { signal });

  if (!response.ok) {
    throw new Error(`Puzzle generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as MiniChessResponse;
  assertSolution(
    payload.mate_in,
    payload.solution,
    payload.states.length,
    payload.states.at(-1)?.is_checkmate === true,
  );

  return {
    id: payload.id,
    variant: payload.variant,
    boardWidth: payload.board_width,
    boardHeight: payload.board_height,
    fen: payload.fen,
    mateIn: payload.mate_in,
    sideToMove: payload.side_to_move,
    pieceCount: payload.piece_count,
    rating: payload.rating,
    solution: payload.solution,
    states: payload.states.map((state) => ({
      fen: state.fen,
      turn: state.turn,
      legalMoves: state.legal_moves,
      checkSquare: state.check_square,
      isCheckmate: state.is_checkmate,
    })),
  };
}
