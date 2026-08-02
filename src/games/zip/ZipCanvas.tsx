import { useCallback, useEffect, useMemo, useState } from "react";
import { Graphics, Sprite, type Texture } from "pixi.js";
import {
  CANVAS_BOARD_SIZE,
  CanvasBoard,
  type CanvasBoardAnimationFrame,
  type CanvasBoardHud,
  type CanvasBoardPointer,
  type CanvasCellPosition,
} from "@/shared/canvas/CanvasBoard";
import { addCircle, addLabel, addLine, addRect, cssVar } from "@/shared/canvas/drawing";
import { positionKey } from "./game";
import type { InvalidMove, Position, Puzzle } from "./types";

type ZipCanvasProps = {
  puzzle: Puzzle;
  path: readonly Position[];
  revealImage?: string;
  invalidMove: InvalidMove | null;
  showSolution: boolean;
  disabled: boolean;
  completed: boolean;
  completionRevealComplete: boolean;
  hud: CanvasBoardHud;
  onCompletionRevealComplete: () => void;
  onActivate: (position: CanvasCellPosition) => void;
  onPointerDown: (pointer: CanvasBoardPointer) => void;
  onPointerMove: (pointer: CanvasBoardPointer) => void;
  onPointerUp: () => void;
};

const COMPLETION_REVEAL_DURATION_MS = 1200;

export function ZipCanvas({
  puzzle,
  path,
  revealImage,
  invalidMove,
  showSolution,
  disabled,
  completed,
  completionRevealComplete,
  hud,
  onCompletionRevealComplete,
  onActivate,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: ZipCanvasProps) {
  const [animationImage, setAnimationImage] = useState<HTMLImageElement | null>(null);
  const [animationImageFailed, setAnimationImageFailed] = useState(false);
  const visited = useMemo(() => new Set(path.map(positionKey)), [path]);
  const routePoints = useMemo(
    () => path.flatMap(([row, col]) => [
      (col + 0.5) * (CANVAS_BOARD_SIZE / puzzle.size),
      (row + 0.5) * (CANVAS_BOARD_SIZE / puzzle.size),
    ]),
    [path, puzzle.size],
  );
  const cells = useMemo(
    () =>
      puzzle.board.flatMap((rowValues, row) =>
        rowValues.map((clue, col) => {
          const key = positionKey([row, col]);
          return {
            key,
            row,
            col,
            disabled,
            label: `Row ${row + 1}, column ${col + 1}${clue === null ? "" : `, number ${clue}`}${
              visited.has(key) ? ", in path" : ""
            }`,
          };
        }),
      ),
    [disabled, puzzle.board, visited],
  );

  useEffect(() => {
    if (!revealImage) {
      setAnimationImage(null);
      setAnimationImageFailed(false);
      return;
    }

    let cancelled = false;
    const image = new Image();
    setAnimationImage(null);
    setAnimationImageFailed(false);
    image.decoding = "async";
    image.onload = () => {
      if (!cancelled) {
        setAnimationImage(image);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setAnimationImageFailed(true);
      }
    };
    image.src = revealImage;

    return () => {
      cancelled = true;
    };
  }, [revealImage]);

  useEffect(() => {
    if (!completed || completionRevealComplete) {
      return;
    }

    if (animationImageFailed) {
      onCompletionRevealComplete();
      return;
    }

    if (!animationImage) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onCompletionRevealComplete();
      return;
    }

    const timer = window.setTimeout(onCompletionRevealComplete, COMPLETION_REVEAL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [animationImage, animationImageFailed, completed, completionRevealComplete, onCompletionRevealComplete]);

  const draw = useCallback(
    ({ root, textures, host, cellWidth, cellHeight }: Parameters<React.ComponentProps<typeof CanvasBoard>["draw"]>[0]) => {
      const cell = cssVar(host, "--cell", "#f3f5f6");
      const alternate = cssVar(host, "--cell-alt", "#e9edef");
      const route = cssVar(host, "--route", "#2f82b7");
      const routeDark = cssVar(host, "--route-dark", "#23658e");
      const routeVisited = cssVar(host, "--route-visited", "#dceaf2");
      const grid = cssVar(host, "--game-grid", "#60666c");
      const text = cssVar(host, "--game-text", "#202124");
      const danger = cssVar(host, "--game-danger", "#d24f5d");
      const texture = revealImage ? textures.get(revealImage) : undefined;

      if (texture && completionRevealComplete) {
        root.addChild(createBoardCoverSprite(texture));
        addRect(root, 2, 2, 996, 996, "transparent", { color: grid, width: 5 }, 4);
        return;
      }

      puzzle.board.forEach((rowValues, row) => {
        rowValues.forEach((_, col) => {
          const key = positionKey([row, col]);
          const x = col * cellWidth;
          const y = row * cellHeight;
          addRect(root, x, y, cellWidth, cellHeight, visited.has(key) && !texture ? routeVisited : (row + col) % 2 ? alternate : cell);
          if (
            !showSolution &&
            invalidMove?.target[0] === row &&
            invalidMove.target[1] === col
          ) {
            addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, danger, undefined, 5).alpha = 0.16;
            addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, "transparent", { color: danger, width: 6 }, 5);
          }
        });
      });

      const gridGraphic = new Graphics();
      for (let index = 0; index <= puzzle.size; index += 1) {
        gridGraphic.moveTo(index * cellWidth, 0).lineTo(index * cellWidth, 1000);
        gridGraphic.moveTo(0, index * cellHeight).lineTo(1000, index * cellHeight);
      }
      gridGraphic.stroke({ color: grid, width: 3, alpha: 0.34 });
      root.addChild(gridGraphic);

      puzzle.walls.forEach((wall) => {
        if (wall.direction === "right") {
          addLine(
            root,
            [(wall.col + 1) * cellWidth, wall.row * cellHeight, (wall.col + 1) * cellWidth, (wall.row + 1) * cellHeight],
            text,
            Math.max(7, cellWidth * 0.065),
          );
        } else {
          addLine(
            root,
            [wall.col * cellWidth, (wall.row + 1) * cellHeight, (wall.col + 1) * cellWidth, (wall.row + 1) * cellHeight],
            text,
            Math.max(7, cellHeight * 0.065),
          );
        }
      });

      if (path.length > 0) {
        addLine(root, routePoints, routeDark, cellWidth * (texture ? 0.52 : 0.27), texture ? 0.92 : 1);

        if (texture) {
          const routeImage = createBoardCoverSprite(texture);
          const routeMask = new Graphics();
          routeMask.moveTo(routePoints[0], routePoints[1]);
          for (let index = 2; index < routePoints.length; index += 2) {
            routeMask.lineTo(routePoints[index], routePoints[index + 1]);
          }
          routeMask.stroke({ color: "#ffffff", width: cellWidth * 0.44, cap: "round", join: "round" });
          if (routePoints.length === 2) {
            routeMask.circle(routePoints[0], routePoints[1], cellWidth * 0.22).fill("#ffffff");
          }
          routeImage.mask = routeMask;
          root.addChild(routeImage, routeMask);
        } else {
          addLine(root, routePoints, route, cellWidth * 0.18);
        }
      }

      puzzle.board.forEach((rowValues, row) => {
        rowValues.forEach((clue, col) => {
          if (clue === null) {
            return;
          }
          const x = (col + 0.5) * cellWidth;
          const y = (row + 0.5) * cellHeight;
          addCircle(root, x, y, cellWidth * 0.26, cssVar(host, "--game-elevated", "#ffffff"), {
            color: text,
            width: 4,
            alpha: 0.85,
          });
          addLabel(root, String(clue), x, y, {
            color: text,
            fontSize: cellWidth * 0.3,
            fontWeight: "800",
          });
        });
      });

      const endpoint = path.at(-1);
      if (endpoint) {
        addCircle(root, (endpoint[1] + 0.5) * cellWidth, (endpoint[0] + 0.5) * cellHeight, cellWidth * 0.1, route, {
          color: cssVar(host, "--game-surface", "#ffffff"),
          width: 4,
        });
      }
      addRect(root, 2, 2, 996, 996, "transparent", { color: grid, width: 5 }, 4);
    },
    [completionRevealComplete, invalidMove, path, puzzle, revealImage, routePoints, showSolution, visited],
  );

  const animateCompletionReveal = useCallback(
    ({ context, elapsedMilliseconds, size, cellWidth }: CanvasBoardAnimationFrame) => {
      if (!completed || completionRevealComplete || !animationImage || routePoints.length < 2) {
        return;
      }

      const linearProgress = Math.min(1, elapsedMilliseconds / COMPLETION_REVEAL_DURATION_MS);
      const progress = linearProgress * linearProgress;
      const startWidth = cellWidth * 0.44;
      const endWidth = cellWidth * 1.5;

      context.save();
      context.beginPath();
      context.moveTo(routePoints[0], routePoints[1]);
      for (let index = 2; index < routePoints.length; index += 2) {
        context.lineTo(routePoints[index], routePoints[index + 1]);
      }
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = startWidth + (endWidth - startWidth) * progress;
      context.strokeStyle = "#ffffff";
      context.stroke();
      context.globalCompositeOperation = "source-in";
      drawImageCover(context, animationImage, size);
      context.restore();
    },
    [animationImage, completed, completionRevealComplete, routePoints],
  );

  return (
    <CanvasBoard
      className="board"
      ariaLabel={`${puzzle.size} by ${puzzle.size} Zip board`}
      rows={puzzle.size}
      cols={puzzle.size}
      cells={cells}
      assetUrls={revealImage ? [revealImage] : []}
      hud={hud}
      draw={draw}
      animate={completed && revealImage && !completionRevealComplete ? animateCompletionReveal : undefined}
      animationFps={30}
      activateOnPointer={false}
      onCellActivate={onActivate}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

function createBoardCoverSprite(texture: Texture): Sprite {
  const sprite = new Sprite({ texture, anchor: 0.5, x: 500, y: 500 });
  const imageScale = Math.max(CANVAS_BOARD_SIZE / texture.width, CANVAS_BOARD_SIZE / texture.height);
  sprite.width = texture.width * imageScale;
  sprite.height = texture.height * imageScale;
  return sprite;
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
): void {
  const imageScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * imageScale;
  const height = image.naturalHeight * imageScale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
}
