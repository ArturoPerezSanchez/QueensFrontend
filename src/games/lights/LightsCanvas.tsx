import { useCallback, useMemo } from "react";
import { Graphics } from "pixi.js";
import { CanvasBoard, type CanvasBoardHud, type CanvasCellPosition } from "@/shared/canvas/CanvasBoard";
import { addCircle, addRect, addSprite, cssVar } from "@/shared/canvas/drawing";
import { positionKey } from "./game";
import type { Board } from "./types";

type LightsCanvasProps = {
  board: Board;
  bulbs: readonly [string, string];
  solutionPresses: ReadonlySet<string>;
  disabled: boolean;
  hud: CanvasBoardHud;
  onActivate: (position: CanvasCellPosition) => void;
};

export function LightsCanvas({ board, bulbs, solutionPresses, disabled, hud, onActivate }: LightsCanvasProps) {
  const size = board.length;
  const cells = useMemo(
    () =>
      board.flatMap((rowValues, row) =>
        rowValues.map((value, col) => ({
          key: positionKey([row, col]),
          row,
          col,
          disabled,
          label: `Row ${row + 1}, column ${col + 1}: ${value ? "lit" : "dark"}${
            solutionPresses.has(positionKey([row, col])) ? ", solution press" : ""
          }`,
        })),
      ),
    [board, disabled, solutionPresses],
  );

  const draw = useCallback(
    ({ root, textures, host, cellWidth, cellHeight }: Parameters<React.ComponentProps<typeof CanvasBoard>["draw"]>[0]) => {
      const base = cssVar(host, "--cell", "#eef1f3");
      const alt = cssVar(host, "--cell-alt", "#e6eaed");
      const grid = cssVar(host, "--game-grid", "#646b72");
      const glow = cssVar(host, "--glow", "#e8b83f");
      const route = cssVar(host, "--route", "#2f8f83");

      board.forEach((rowValues, row) => {
        rowValues.forEach((value, col) => {
          const x = col * cellWidth;
          const y = row * cellHeight;
          const key = positionKey([row, col]);
          addRect(root, x, y, cellWidth, cellHeight, (row + col) % 2 ? alt : base);

          if (value === 1) {
            addCircle(root, x + cellWidth / 2, y + cellHeight / 2, cellWidth * 0.34, glow).alpha = 0.12;
          }
          addSprite(
            root,
            textures.get(bulbs[value]),
            x + cellWidth / 2,
            y + cellHeight / 2,
            cellWidth * 0.51,
          );

          if (solutionPresses.has(key)) {
            addCircle(root, x + cellWidth / 2, y + cellHeight / 2, cellWidth * 0.12, route, {
              color: cssVar(host, "--game-surface", "#ffffff"),
              width: 4,
            });
            addRect(root, x + 6, y + 6, cellWidth - 12, cellHeight - 12, "transparent", { color: route, width: 5 }, 5);
          }
        });
      });

      const gridGraphic = new Graphics();
      for (let index = 0; index <= size; index += 1) {
        gridGraphic.moveTo(index * cellWidth, 0).lineTo(index * cellWidth, 1000);
        gridGraphic.moveTo(0, index * cellHeight).lineTo(1000, index * cellHeight);
      }
      gridGraphic.stroke({ color: grid, width: 3, alpha: 0.42 });
      root.addChild(gridGraphic);
      addRect(root, 2, 2, 996, 996, "transparent", { color: grid, width: 5 }, 4);
    },
    [board, bulbs, size, solutionPresses],
  );

  return (
    <CanvasBoard
      className="board"
      ariaLabel={`${size} by ${size} Lights board`}
      rows={size}
      cols={size}
      cells={cells}
      assetUrls={bulbs}
      hud={hud}
      draw={draw}
      onCellActivate={onActivate}
    />
  );
}
