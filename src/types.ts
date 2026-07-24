export type Position = readonly [row: number, col: number];

export type QueensResponse = {
  board: number[][];
  solution: Position[] | null;
};

export type Puzzle = {
  board: number[][];
  solution: Position[] | null;
  size: number;
};

export type ViolationKind = "row" | "column" | "region" | "adjacent";

export type GameStatus = {
  isSolved: boolean;
  queenCount: number;
  conflicts: Set<string>;
  violations: Record<ViolationKind, number>;
};
