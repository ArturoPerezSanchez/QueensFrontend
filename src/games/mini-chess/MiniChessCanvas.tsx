import { useCallback, useMemo } from "react";
import { Graphics } from "pixi.js";
import {
  CanvasBoard,
  type CanvasBoardHud,
  type CanvasBoardPointer,
  type CanvasCellPosition,
} from "@/shared/canvas/CanvasBoard";
import { addCircle, addLabel, addRect, addSprite, cssVar } from "@/shared/canvas/drawing";
import { isBottomRank, isDarkSquare, isLeftFile, pieceLabel } from "./game";
import type { BoardPiece, LastMove, SideName, SquareId } from "./types";

export type CanvasDragPreview = {
  piece: BoardPiece;
  x: number;
  y: number;
};

type MiniChessCanvasProps = {
  width: number;
  height: number;
  orientation: SideName;
  squares: readonly SquareId[];
  pieces: ReadonlyMap<SquareId, BoardPiece>;
  pieceSetRoot: string;
  pieceExtension: "svg" | "png" | "webp";
  selectedSquare: SquareId | null;
  targets: ReadonlySet<SquareId>;
  lastMove: LastMove | null;
  checkSquare: SquareId | null;
  wrongSquare: SquareId | null;
  draggingSquare: SquareId | null;
  dragPreview: CanvasDragPreview | null;
  disabled: boolean;
  ariaLabel: string;
  hud: CanvasBoardHud;
  onActivate: (position: CanvasCellPosition) => void;
  onPointerDown: (pointer: CanvasBoardPointer) => void;
  onPointerMove: (pointer: CanvasBoardPointer) => void;
  onPointerUp: (pointer: CanvasBoardPointer) => void;
  onPointerCancel: () => void;
};

function pieceUrl(root: string, extension: string, piece: BoardPiece): string {
  return `${root}/${piece.color}${piece.type}.${extension}`;
}

export function MiniChessCanvas({
  width,
  height,
  orientation,
  squares,
  pieces,
  pieceSetRoot,
  pieceExtension,
  selectedSquare,
  targets,
  lastMove,
  checkSquare,
  wrongSquare,
  draggingSquare,
  dragPreview,
  disabled,
  ariaLabel,
  hud,
  onActivate,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: MiniChessCanvasProps) {
  const cells = useMemo(
    () =>
      squares.map((square, index) => ({
        key: square,
        row: Math.floor(index / width),
        col: index % width,
        disabled,
        pressed: selectedSquare === square,
        label: pieces.has(square) ? `${pieceLabel(pieces.get(square)!)} on ${square}` : `Empty ${square}`,
      })),
    [disabled, pieces, selectedSquare, squares, width],
  );
  const assets = useMemo(
    () =>
      [...new Set([
        ...[...pieces.values()].map((piece) => pieceUrl(pieceSetRoot, pieceExtension, piece)),
        ...(dragPreview ? [pieceUrl(pieceSetRoot, pieceExtension, dragPreview.piece)] : []),
      ])],
    [dragPreview, pieceExtension, pieceSetRoot, pieces],
  );

  const draw = useCallback(
    ({ root, textures, host, cellWidth, cellHeight }: Parameters<React.ComponentProps<typeof CanvasBoard>["draw"]>[0]) => {
      const light = cssVar(host, "--board-light", "#d9d3c3");
      const dark = cssVar(host, "--board-dark", "#6f8f82");
      const frame = cssVar(host, "--board-frame", "#3a4744");
      const accent = cssVar(host, "--accent", "#b38932");
      const danger = cssVar(host, "--game-danger", "#d24f5d");
      const text = cssVar(host, "--game-text", "#202124");

      squares.forEach((square, index) => {
        const row = Math.floor(index / width);
        const col = index % width;
        const x = col * cellWidth;
        const y = row * cellHeight;
        const piece = pieces.get(square);
        addRect(root, x, y, cellWidth, cellHeight, isDarkSquare(square) ? dark : light);

        if (lastMove?.from === square || lastMove?.to === square) {
          addRect(root, x, y, cellWidth, cellHeight, accent).alpha = 0.22;
        }
        if (checkSquare === square) {
          addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, danger, undefined, 5).alpha = 0.26;
        }
        if (selectedSquare === square) {
          addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, accent, undefined, 5).alpha = 0.16;
          addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, "transparent", { color: accent, width: 7 }, 5);
        }
        if (wrongSquare === square) {
          addRect(root, x + 5, y + 5, cellWidth - 10, cellHeight - 10, "transparent", { color: danger, width: 7 }, 5);
        }
        if (targets.has(square)) {
          addCircle(root, x + cellWidth / 2, y + cellHeight / 2, piece ? cellWidth * 0.34 : cellWidth * 0.095, accent, piece ? {
            color: accent,
            width: 5,
          } : undefined).alpha = piece ? 0.18 : 0.72;
        }

        if (piece && draggingSquare !== square) {
          addSprite(
            root,
            textures.get(pieceUrl(pieceSetRoot, pieceExtension, piece)),
            x + cellWidth / 2,
            y + cellHeight / 2,
            cellWidth * 0.78,
            cellHeight * 0.78,
          );
        }

        if (isLeftFile(square, orientation, width)) {
          addLabel(root, square.slice(1), x + cellWidth * 0.09, y + cellHeight * 0.16, {
            color: text,
            fontSize: cellWidth * 0.11,
            fontWeight: "800",
            anchor: 0.5,
          }).alpha = 0.68;
        }
        if (isBottomRank(square, orientation, height)) {
          addLabel(root, square[0], x + cellWidth * 0.88, y + cellHeight * 0.88, {
            color: text,
            fontSize: cellWidth * 0.11,
            fontWeight: "800",
            anchor: 0.5,
          }).alpha = 0.68;
        }
      });

      if (dragPreview) {
        const preview = addSprite(
          root,
          textures.get(pieceUrl(pieceSetRoot, pieceExtension, dragPreview.piece)),
          dragPreview.x,
          dragPreview.y,
          cellWidth * 0.86,
          cellHeight * 0.86,
        );
        if (preview) {
          preview.alpha = 0.92;
        }
      }

      const grid = new Graphics();
      for (let col = 0; col <= width; col += 1) {
        grid.moveTo(col * cellWidth, 0).lineTo(col * cellWidth, 1000);
      }
      for (let row = 0; row <= height; row += 1) {
        grid.moveTo(0, row * cellHeight).lineTo(1000, row * cellHeight);
      }
      grid.stroke({ color: frame, width: 2, alpha: 0.35 });
      root.addChild(grid);
      addRect(root, 2, 2, 996, 996, "transparent", { color: frame, width: 8 }, 3);
    },
    [
      checkSquare,
      dragPreview,
      draggingSquare,
      height,
      lastMove,
      orientation,
      pieceExtension,
      pieceSetRoot,
      pieces,
      selectedSquare,
      squares,
      targets,
      width,
      wrongSquare,
    ],
  );

  return (
    <CanvasBoard
      className="chess-board"
      ariaLabel={ariaLabel}
      rows={height}
      cols={width}
      cells={cells}
      assetUrls={assets}
      hud={hud}
      draw={draw}
      activateOnPointer={false}
      onCellActivate={onActivate}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}
