export type Position = readonly [row: number, col: number];
export type WallDirection = "right" | "down";

export type Wall = {
  row: number;
  col: number;
  direction: WallDirection;
};

export type ZipResponse = {
  board_size: number;
  board: Array<Array<number | null>>;
  walls: Wall[];
  solution: Array<[number, number]> | null;
};

export type Puzzle = {
  size: number;
  board: Array<Array<number | null>>;
  walls: Wall[];
  solution: Position[];
};

export type InvalidMoveKind =
  | "not-adjacent"
  | "wall"
  | "visited"
  | "clue-order"
  | "finish-too-soon";

export type InvalidMove = {
  kind: InvalidMoveKind;
  target: Position;
  expectedClue?: number;
  actualClue?: number;
};

export type StepResult =
  | {
      accepted: true;
      path: Position[];
      changed: boolean;
    }
  | {
      accepted: false;
      path: Position[];
      error: InvalidMove;
    };

