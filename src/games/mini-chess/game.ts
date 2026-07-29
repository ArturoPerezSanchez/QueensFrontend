import type {
  BoardPiece,
  PuzzleState,
  SideName,
  SolutionMove,
  SquareId,
} from "./types";

const PIECE_NAMES = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
} as const;

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function sideLabel(side: SideName): string {
  return side === "white" ? "White" : "Black";
}

export function boardSquares(side: SideName, width: number, height: number): SquareId[] {
  const files = Array.from({ length: width }, (_, index) => String.fromCharCode(97 + index));
  const ranks = Array.from({ length: height }, (_, index) => String(height - index));
  if (side === "black") {
    files.reverse();
    ranks.reverse();
  }
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

export function parseFen(fen: string, height: number): Map<SquareId, BoardPiece> {
  const pieces = new Map<SquareId, BoardPiece>();
  const rows = fen.split(" ")[0].split("/");

  rows.forEach((row, rowIndex) => {
    let fileIndex = 0;
    for (const character of row) {
      if (/\d/.test(character)) {
        fileIndex += Number(character);
        continue;
      }
      const type = character.toLowerCase() as BoardPiece["type"];
      pieces.set(`${String.fromCharCode(97 + fileIndex)}${height - rowIndex}`, {
        color: character === character.toUpperCase() ? "w" : "b",
        type,
      });
      fileIndex += 1;
    }
  });
  return pieces;
}

export function legalTargets(state: PuzzleState | null, square: SquareId | null): Set<SquareId> {
  if (!state || !square) {
    return new Set();
  }
  return new Set(
    state.legalMoves
      .filter((move) => move.from === square)
      .map((move) => move.to),
  );
}

export function isExpectedMove(from: SquareId, to: SquareId, expected: SolutionMove | undefined): boolean {
  return Boolean(expected && expected.from === from && expected.to === to);
}

export function pieceAsset(piece: BoardPiece): string {
  return `/games/mini-chess/pieces/${piece.color}${piece.type}.svg`;
}

export function pieceLabel(piece: BoardPiece): string {
  return `${piece.color === "w" ? "White" : "Black"} ${PIECE_NAMES[piece.type]}`;
}

export function isDarkSquare(square: SquareId): boolean {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square.slice(1));
  return (file + rank) % 2 === 1;
}

export function completedSolverMoves(ply: number): number {
  return Math.ceil(ply / 2);
}

export function isBottomRank(square: SquareId, side: SideName, height: number): boolean {
  return square.slice(1) === (side === "white" ? "1" : String(height));
}

export function isLeftFile(square: SquareId, side: SideName, width: number): boolean {
  return square[0] === (side === "white" ? "a" : String.fromCharCode(96 + width));
}
