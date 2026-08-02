import { useCallback, useMemo } from "react";
import { Graphics } from "pixi.js";
import { CanvasBoard, type CanvasBoardHud, type CanvasBoardPointer, type CanvasCellPosition } from "@/shared/canvas/CanvasBoard";
import { addLine, addRect, addSprite, cssVar } from "@/shared/canvas/drawing";
import { positionKey } from "./game";

type QueensCanvasProps = {
  board: number[][];
  marker: string;
  queens: ReadonlySet<string>;
  marks: ReadonlySet<string>;
  conflicts: ReadonlySet<string>;
  conflictHints: ReadonlySet<string>;
  solutionCells: ReadonlySet<string>;
  showSolution: boolean;
  showPatterns: boolean;
  hud: CanvasBoardHud;
  onActivate: (position: CanvasCellPosition) => void;
  onContextMenu: (position: CanvasCellPosition) => void;
  onPointerDown: (pointer: CanvasBoardPointer) => void;
  onPointerMove: (pointer: CanvasBoardPointer) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

export function QueensCanvas({
  board,
  marker,
  queens,
  marks,
  conflicts,
  conflictHints,
  solutionCells,
  showSolution,
  showPatterns,
  hud,
  onActivate,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: QueensCanvasProps) {
  const size = board.length;
  const cells = useMemo(
    () =>
      board.flatMap((rowValues, row) =>
        rowValues.map((region, col) => {
          const key = positionKey(row, col);
          return {
            key,
            row,
            col,
            label: `Row ${row + 1}, column ${col + 1}, region ${region}${
              marks.has(key) ? ", marked unavailable" : ""
            }`,
            pressed: queens.has(key),
          };
        }),
      ),
    [board, marks, queens],
  );

  const draw = useCallback(
    ({ root, textures, host, cellWidth, cellHeight }: Parameters<React.ComponentProps<typeof CanvasBoard>["draw"]>[0]) => {
      const grid = cssVar(host, "--game-grid", "#202124");
      const text = cssVar(host, "--game-text", "#202124");
      const danger = cssVar(host, "--game-danger", "#d24f5d");
      const focus = cssVar(host, "--game-focus", "#3676c5");

      board.forEach((rowValues, row) => {
        rowValues.forEach((region, col) => {
          const key = positionKey(row, col);
          const x = col * cellWidth;
          const y = row * cellHeight;
          const regionColor = cssVar(host, `--region-${(Math.abs(region) % 10) + 1}`, "#d6d9dd");
          addRect(root, x, y, cellWidth, cellHeight, regionColor);

          if (showPatterns) {
            const pattern = new Graphics();
            const spacing = Math.max(13, cellWidth * 0.18);
            for (let offset = -cellHeight; offset < cellWidth; offset += spacing) {
              pattern.moveTo(x + offset, y + cellHeight).lineTo(x + offset + cellHeight, y);
            }
            pattern.stroke({ color: "#ffffff", width: 2, alpha: 0.1 });
            root.addChild(pattern);
          }

          if (conflictHints.has(key)) {
            addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, danger, undefined, 5).alpha = 0.12;
          }

          const isSolution = showSolution && solutionCells.has(key) && !queens.has(key);
          if (queens.has(key) || isSolution) {
            const piece = addSprite(
              root,
              textures.get(marker),
              x + cellWidth / 2,
              y + cellHeight / 2,
              cellWidth * 0.58,
            );
            if (piece && isSolution) {
              piece.alpha = 0.42;
            }
          }

          if (marks.has(key)) {
            const inset = cellWidth * 0.35;
            addLine(root, [x + inset, y + inset, x + cellWidth - inset, y + cellHeight - inset], text, 4, 0.6);
            addLine(root, [x + cellWidth - inset, y + inset, x + inset, y + cellHeight - inset], text, 4, 0.6);
          }

          if (conflicts.has(key)) {
            addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, "transparent", { color: danger, width: 7 }, 4);
          } else if (isSolution) {
            addRect(root, x + 6, y + 6, cellWidth - 12, cellHeight - 12, "transparent", { color: focus, width: 5 }, 4);
          }
        });
      });

      const cellGrid = new Graphics();
      for (let index = 0; index <= size; index += 1) {
        cellGrid.moveTo(index * cellWidth, 0).lineTo(index * cellWidth, 1000);
        cellGrid.moveTo(0, index * cellHeight).lineTo(1000, index * cellHeight);
      }
      cellGrid.stroke({ color: grid, width: Math.max(1.5, 10 / size), alpha: 0.28 });
      root.addChild(cellGrid);

      const borders = new Graphics();
      board.forEach((rowValues, row) => {
        rowValues.forEach((region, col) => {
          const x = col * cellWidth;
          const y = row * cellHeight;
          if (col === 0 || board[row][col - 1] !== region) {
            borders.moveTo(x, y).lineTo(x, y + cellHeight);
          }
          if (row === 0 || board[row - 1][col] !== region) {
            borders.moveTo(x, y).lineTo(x + cellWidth, y);
          }
          if (col === size - 1) {
            borders.moveTo(x + cellWidth, y).lineTo(x + cellWidth, y + cellHeight);
          }
          if (row === size - 1) {
            borders.moveTo(x, y + cellHeight).lineTo(x + cellWidth, y + cellHeight);
          }
        });
      });
      borders.stroke({ color: grid, width: Math.max(2, 15 / size), alpha: 0.65 });
      root.addChild(borders);
      addRect(root, 2, 2, 996, 996, "transparent", { color: grid, width: 5 }, 4);
    },
    [board, conflictHints, conflicts, marker, queens, showPatterns, showSolution, size, solutionCells, marks],
  );

  return (
    <CanvasBoard
      className="board"
      ariaLabel={`${size} by ${size} Queens board`}
      rows={size}
      cols={size}
      cells={cells}
      assetUrls={[marker]}
      hud={hud}
      draw={draw}
      onCellActivate={onActivate}
      onCellContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
