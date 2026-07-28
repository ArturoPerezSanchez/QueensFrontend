export type Position = readonly [row: number, col: number];
export type Board = number[][];

export type TracksResponse = {
  board_size: number;
  board: Board;
  start: [number, number];
  end: [number, number];
  solution: Board | null;
};

export type Puzzle = {
  size: number;
  board: Board;
  start: Position;
  end: Position;
  solution: Board;
};
