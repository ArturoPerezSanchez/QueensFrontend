export type Position = readonly [row: number, col: number];
export type Board = number[][];

export type LightsResponse = {
  board_size: number;
  board: Board;
  solution: Array<[number, number]> | null;
};

export type Puzzle = {
  size: number;
  board: Board;
  solution: Position[];
};
