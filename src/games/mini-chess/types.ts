export type SideName = "white" | "black";
export type BoardSize = 5 | 8;
export type PieceColor = "w" | "b";
export type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";
export type SquareId = string;

export type BoardPiece = {
  color: PieceColor;
  type: PieceSymbol;
};

export type SolutionMove = {
  from: SquareId;
  to: SquareId;
  promotion: PieceSymbol | null;
  san: string | null;
};

export type PuzzleState = {
  fen: string;
  turn: SideName;
  legalMoves: SolutionMove[];
  checkSquare: SquareId | null;
  isCheckmate: boolean;
};

export type MiniChessResponse = {
  id: string;
  variant: "standard" | "gardner";
  board_width: number;
  board_height: number;
  fen: string;
  mate_in: number;
  side_to_move: SideName;
  piece_count: number;
  rating: number | null;
  solution: SolutionMove[] | null;
  states: Array<{
    fen: string;
    turn: SideName;
    legal_moves: SolutionMove[];
    check_square: SquareId | null;
    is_checkmate: boolean;
  }>;
};

export type Puzzle = {
  id: string;
  variant: "standard" | "gardner";
  boardWidth: number;
  boardHeight: number;
  fen: string;
  mateIn: number;
  sideToMove: SideName;
  pieceCount: number;
  rating: number | null;
  solution: SolutionMove[];
  states: PuzzleState[];
};

export type LastMove = {
  from: SquareId;
  to: SquareId;
};
