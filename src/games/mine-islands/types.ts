export type Position = readonly [row: number, col: number];
export type CellValue = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Board = CellValue[][];
export type Visibility = "hidden" | "revealed" | "flagged";
export type VisibilityBoard = Visibility[][];

export type MineIslandsResponse = {
  board_size: number;
  mine_count: number;
  board: null[][];
  solution: Board | null;
};

export type Puzzle = {
  size: number;
  mineCount: number;
  solution: Board;
};

export type RevealResult = {
  visibility: VisibilityBoard;
  hitMine: boolean;
  changed: boolean;
};
