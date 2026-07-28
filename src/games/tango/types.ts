export type SymbolValue = 0 | 1;
export type CellValue = SymbolValue | null;
export type Direction = "horizontal" | "vertical";
export type Relation = "same" | "different";

export type Constraint = {
  row: number;
  col: number;
  direction: Direction;
  relation: Relation;
};

export type TangoResponse = {
  board_size: number;
  board: CellValue[][];
  constraints: Constraint[];
  solution: SymbolValue[][] | null;
};

export type Puzzle = {
  size: number;
  board: CellValue[][];
  constraints: Constraint[];
  solution: SymbolValue[][];
};

export type ViolationKind = "balance" | "triple" | "relation";

export type GameStatus = {
  isSolved: boolean;
  filledCount: number;
  conflicts: Set<string>;
  violations: Record<ViolationKind, number>;
};
