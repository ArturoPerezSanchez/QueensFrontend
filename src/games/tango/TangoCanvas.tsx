import { useCallback, useMemo } from "react";
import { Graphics } from "pixi.js";
import type { SkinSymbolAsset } from "@/features/skins/skins";
import { CanvasBoard, type CanvasBoardHud, type CanvasCellPosition } from "@/shared/canvas/CanvasBoard";
import { addLabel, addRect, addSprite, cssVar } from "@/shared/canvas/drawing";
import { positionKey } from "./game";
import type { CellValue, Constraint, Puzzle } from "./types";

type TangoCanvasProps = {
  puzzle: Puzzle;
  entries: CellValue[][];
  symbols: readonly [SkinSymbolAsset, SkinSymbolAsset];
  conflicts: ReadonlySet<string>;
  showSolution: boolean;
  hud: CanvasBoardHud;
  onActivate: (position: CanvasCellPosition) => void;
  onContextMenu: (position: CanvasCellPosition) => void;
};

function relationPosition(constraint: Constraint, cellWidth: number, cellHeight: number) {
  return constraint.direction === "horizontal"
    ? {
        x: (constraint.col + 1) * cellWidth,
        y: (constraint.row + 0.5) * cellHeight,
        width: cellWidth * 0.27,
        height: cellHeight * 0.42,
      }
    : {
        x: (constraint.col + 0.5) * cellWidth,
        y: (constraint.row + 1) * cellHeight,
        width: cellWidth * 0.42,
        height: cellHeight * 0.27,
      };
}

export function TangoCanvas({
  puzzle,
  entries,
  symbols,
  conflicts,
  showSolution,
  hud,
  onActivate,
  onContextMenu,
}: TangoCanvasProps) {
  const cells = useMemo(
    () =>
      entries.flatMap((rowValues, row) =>
        rowValues.map((value, col) => {
          const shown = showSolution ? puzzle.solution[row][col] : value;
          const given = puzzle.board[row][col] !== null;
          return {
            key: positionKey(row, col),
            row,
            col,
            disabled: given || showSolution,
            label: `Row ${row + 1}, column ${col + 1}: ${
              shown === null ? "empty" : symbols[shown].label.toLowerCase()
            }${given ? ", given" : ""}`,
          };
        }),
      ),
    [entries, puzzle.board, puzzle.solution, showSolution, symbols],
  );

  const draw = useCallback(
    ({ root, textures, host, cellWidth, cellHeight }: Parameters<React.ComponentProps<typeof CanvasBoard>["draw"]>[0]) => {
      const cell = cssVar(host, "--board-cell", "#f8f9fa");
      const givenCell = cssVar(host, "--board-given", "#e1e4e7");
      const grid = cssVar(host, "--game-grid", "#60656b");
      const danger = cssVar(host, "--game-danger", "#d24f5d");
      const text = cssVar(host, "--game-text", "#202124");

      entries.forEach((rowValues, row) => {
        rowValues.forEach((value, col) => {
          const x = col * cellWidth;
          const y = row * cellHeight;
          const given = puzzle.board[row][col] !== null;
          const shown = showSolution ? puzzle.solution[row][col] : value;
          addRect(root, x, y, cellWidth, cellHeight, given ? givenCell : cell);

          const key = positionKey(row, col);
          if (conflicts.has(key) && !showSolution) {
            addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, danger, undefined, 5).alpha = 0.13;
            addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, "transparent", { color: danger, width: 6 }, 5);
          }

          if (shown !== null) {
            const asset = symbols[shown];
            const symbolScale = given ? 0.58 : 0.53;
            const sprite = addSprite(
              root,
              textures.get(asset.src),
              x + cellWidth / 2,
              y + cellHeight / 2,
              cellWidth * symbolScale,
              cellHeight * symbolScale,
            );
            if (sprite && showSolution && !given) {
              sprite.alpha = 0.62;
            }
          }
        });
      });

      const gridGraphic = new Graphics();
      for (let index = 0; index <= puzzle.size; index += 1) {
        gridGraphic.moveTo(index * cellWidth, 0).lineTo(index * cellWidth, 1000);
        gridGraphic.moveTo(0, index * cellHeight).lineTo(1000, index * cellHeight);
      }
      gridGraphic.stroke({ color: grid, width: 3, alpha: 0.58 });
      root.addChild(gridGraphic);

      puzzle.constraints.forEach((constraint) => {
        const position = relationPosition(constraint, cellWidth, cellHeight);
        addRect(
          root,
          position.x - position.width / 2,
          position.y - position.height / 2,
          position.width,
          position.height,
          cssVar(host, "--game-elevated", "#ffffff"),
          { color: grid, width: 3 },
          Math.min(position.width, position.height) * 0.28,
        );
        addLabel(root, constraint.relation === "same" ? "=" : "x", position.x, position.y - 1, {
          color: text,
          fontSize: Math.min(position.width, position.height) * 0.62,
          fontWeight: "800",
        });
      });

      addRect(root, 2, 2, 996, 996, "transparent", { color: grid, width: 5 }, 4);
    },
    [conflicts, entries, puzzle, showSolution, symbols],
  );

  return (
    <CanvasBoard
      className="board"
      ariaLabel={`${puzzle.size} by ${puzzle.size} Tango board`}
      rows={puzzle.size}
      cols={puzzle.size}
      cells={cells}
      assetUrls={symbols.map((symbol) => symbol.src)}
      hud={hud}
      draw={draw}
      onCellActivate={onActivate}
      onCellContextMenu={onContextMenu}
    />
  );
}
