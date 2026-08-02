import { useCallback, useEffect, useMemo, useState } from "react";
import { Graphics, type Container } from "pixi.js";
import type { GameSkinAssetMap } from "@/features/skins/skins";
import {
  CANVAS_BOARD_SIZE,
  CanvasBoard,
  type CanvasBoardAnimationFrame,
  type CanvasBoardHud,
  type CanvasCellPosition,
  type CanvasWheelDirection,
} from "@/shared/canvas/CanvasBoard";
import { addCircle, addRect, addSprite, cssVar, type CssColor } from "@/shared/canvas/drawing";
import {
  DIRECTIONS,
  DIRECTION_DELTAS,
  OPPOSITE_DIRECTIONS,
  positionKey,
} from "./game";
import type { Board, Puzzle } from "./types";

export type FlowCell = {
  centerPhase: number;
  inbound: number | null;
  outbound: number[];
};

type Point = {
  x: number;
  y: number;
};

type SegmentLayer = "underpass" | "standard" | "overpass";

type PipeSegment = {
  from: Point;
  to: Point;
  layer: SegmentLayer;
};

type FlowSegment = PipeSegment & {
  phase: number;
};

type TrackGeometry = {
  arms: PipeSegment[];
  bridges: PipeSegment[];
  flowSegments: FlowSegment[];
  startPoint: Point;
  endPoint: Point;
};

type TracksCanvasProps = {
  board: Board;
  puzzle: Puzzle;
  flow: ReadonlyMap<string, FlowCell>;
  crossingGaps: ReadonlyMap<string, ReadonlySet<number>>;
  assets: GameSkinAssetMap["tracks"];
  disabled: boolean;
  solutionShown: boolean;
  hud: CanvasBoardHud;
  onActivate: (position: CanvasCellPosition) => void;
  onWheelRotate: (position: CanvasCellPosition, direction: CanvasWheelDirection) => void;
};

const ARM_RADIUS_RATIO = 0.31;
const PIPE_WIDTH_RATIO = 0.18;
const CHANNEL_WIDTH_RATIO = 0.105;
const FLUID_WIDTH_RATIO = 0.082;
const PULSE_WIDTH_RATIO = 0.046;

type FlowParticleDefinition = NonNullable<GameSkinAssetMap["tracks"]["flowParticle"]>;

function pointAtDirection(center: Point, direction: number, distance: number): Point {
  const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
  const magnitude = Math.hypot(rowDelta, colDelta) || 1;
  return {
    x: center.x + (colDelta / magnitude) * distance,
    y: center.y + (rowDelta / magnitude) * distance,
  };
}

function edgeKey(size: number, row: number, col: number, neighborRow: number, neighborCol: number): string {
  const current = row * size + col;
  const neighbor = neighborRow * size + neighborCol;
  return current < neighbor ? `${current}:${neighbor}` : `${neighbor}:${current}`;
}

function midpointKey(segment: PipeSegment): string {
  const x = Math.round(((segment.from.x + segment.to.x) / 2) * 1000);
  const y = Math.round(((segment.from.y + segment.to.y) / 2) * 1000);
  return `${x}:${y}`;
}

function buildGeometry(
  board: Board,
  puzzle: Puzzle,
  flow: ReadonlyMap<string, FlowCell>,
  crossingGaps: ReadonlyMap<string, ReadonlySet<number>>,
): TrackGeometry {
  const size = board.length;
  const cellSize = CANVAS_BOARD_SIZE / size;
  const armRadius = cellSize * ARM_RADIUS_RATIO;
  const arms: PipeSegment[] = [];
  const bridges: PipeSegment[] = [];
  const bridgesByEdge = new Map<string, PipeSegment>();

  const centerFor = (row: number, col: number): Point => ({
    x: (col + 0.5) * cellSize,
    y: (row + 0.5) * cellSize,
  });

  board.forEach((rowValues, row) => {
    rowValues.forEach((mask, col) => {
      const center = centerFor(row, col);
      for (const direction of DIRECTIONS) {
        if (!(mask & direction)) {
          continue;
        }

        const socket = pointAtDirection(center, direction, armRadius);
        arms.push({ from: center, to: socket, layer: "standard" });

        const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
        const neighborRow = row + rowDelta;
        const neighborCol = col + colDelta;
        if (
          neighborRow < 0 ||
          neighborCol < 0 ||
          neighborRow >= size ||
          neighborCol >= size ||
          !(board[neighborRow][neighborCol] & OPPOSITE_DIRECTIONS[direction])
        ) {
          continue;
        }

        const connectionKey = edgeKey(size, row, col, neighborRow, neighborCol);
        if (bridgesByEdge.has(connectionKey)) {
          continue;
        }

        const neighborCenter = centerFor(neighborRow, neighborCol);
        const neighborSocket = pointAtDirection(
          neighborCenter,
          OPPOSITE_DIRECTIONS[direction],
          armRadius,
        );
        const isUnderpass =
          Boolean(crossingGaps.get(positionKey([row, col]))?.has(direction)) ||
          Boolean(
            crossingGaps
              .get(positionKey([neighborRow, neighborCol]))
              ?.has(OPPOSITE_DIRECTIONS[direction]),
          );
        const bridge: PipeSegment = {
          from: socket,
          to: neighborSocket,
          layer: isUnderpass ? "underpass" : "standard",
        };
        bridges.push(bridge);
        bridgesByEdge.set(connectionKey, bridge);
      }
    });
  });

  const bridgesAtMidpoint = new Map<string, PipeSegment[]>();
  for (const bridge of bridges) {
    const key = midpointKey(bridge);
    const group = bridgesAtMidpoint.get(key) ?? [];
    group.push(bridge);
    bridgesAtMidpoint.set(key, group);
  }
  for (const group of bridgesAtMidpoint.values()) {
    if (group.some((bridge) => bridge.layer === "underpass")) {
      group.forEach((bridge) => {
        if (bridge.layer === "standard") {
          bridge.layer = "overpass";
        }
      });
    }
  }

  const flowSegments: FlowSegment[] = [];
  const seenFlowEdges = new Set<string>();
  board.forEach((rowValues, row) => {
    rowValues.forEach((mask, col) => {
      const cellFlow = flow.get(positionKey([row, col]));
      if (!cellFlow) {
        return;
      }

      const center = centerFor(row, col);
      const phase = (cellFlow.centerPhase * cellSize) / 100;
      for (const direction of cellFlow.outbound) {
        const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
        const neighborRow = row + rowDelta;
        const neighborCol = col + colDelta;
        const connectionKey = edgeKey(size, row, col, neighborRow, neighborCol);
        if (seenFlowEdges.has(connectionKey)) {
          continue;
        }
        seenFlowEdges.add(connectionKey);
        flowSegments.push({
          from: center,
          to: centerFor(neighborRow, neighborCol),
          layer: bridgesByEdge.get(connectionKey)?.layer ?? "standard",
          phase,
        });
      }

      for (const direction of DIRECTIONS) {
        if (!(mask & direction)) {
          continue;
        }
        const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
        const neighborRow = row + rowDelta;
        const neighborCol = col + colDelta;
        const isReciprocal =
          neighborRow >= 0 &&
          neighborCol >= 0 &&
          neighborRow < size &&
          neighborCol < size &&
          Boolean(board[neighborRow][neighborCol] & OPPOSITE_DIRECTIONS[direction]);
        if (!isReciprocal) {
          flowSegments.push({
            from: center,
            to: pointAtDirection(center, direction, armRadius),
            layer: "standard",
            phase,
          });
        }
      }
    });
  });

  return {
    arms,
    bridges,
    flowSegments,
    startPoint: centerFor(puzzle.start[0], puzzle.start[1]),
    endPoint: centerFor(puzzle.end[0], puzzle.end[1]),
  };
}

function strokeSegments(
  root: Container,
  segments: readonly PipeSegment[],
  color: CssColor,
  width: number,
  alpha = 1,
): void {
  if (segments.length === 0) {
    return;
  }
  const graphic = new Graphics();
  segments.forEach(({ from, to }) => {
    graphic.moveTo(from.x, from.y).lineTo(to.x, to.y);
  });
  graphic.stroke({ color, width, alpha, cap: "round", join: "round" });
  root.addChild(graphic);
}

function drawCanvasSegments(
  context: CanvasRenderingContext2D,
  segments: readonly FlowSegment[],
  elapsedMilliseconds: number,
  cellWidth: number,
): void {
  const travelled = -(elapsedMilliseconds * cellWidth * 0.78) / 1000;
  const dash = cellWidth * 0.12;
  const gap = cellWidth * 0.17;
  context.setLineDash([dash, gap]);
  segments.forEach(({ from, to, phase }) => {
    context.lineDashOffset = travelled - phase;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  });
  context.setLineDash([]);
}

function drawFlowParticles(
  context: CanvasRenderingContext2D,
  segments: readonly FlowSegment[],
  image: HTMLImageElement,
  definition: FlowParticleDefinition,
  elapsedMilliseconds: number,
  cellWidth: number,
  glow: string,
): void {
  const spacing = Math.max(1, cellWidth * definition.spacing);
  const travelled = -(elapsedMilliseconds * cellWidth * definition.speed) / 1000;
  const opacity = definition.opacity ?? 1;
  const drift = cellWidth * (definition.drift ?? 0);
  const flicker = definition.flicker ?? 0;

  context.save();
  context.globalCompositeOperation = definition.additive ? "lighter" : "source-over";
  context.shadowColor = glow;
  context.shadowBlur = cellWidth * (definition.additive ? 0.1 : 0.035);

  segments.forEach(({ from, to, phase }, segmentIndex) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) {
      return;
    }

    const firstParticle = Math.ceil((phase - travelled) / spacing);
    const lastParticle = Math.floor((phase + length - travelled) / spacing);
    const angle = Math.atan2(dy, dx);
    const normalX = -dy / length;
    const normalY = dx / length;

    for (let particleIndex = firstParticle; particleIndex <= lastParticle; particleIndex += 1) {
      const routeDistance = travelled + particleIndex * spacing;
      const segmentProgress = (routeDistance - phase) / length;
      const seed = Math.abs(Math.sin(particleIndex * 12.9898 + segmentIndex * 7.233));
      const size = cellWidth * definition.size * (0.72 + seed * 0.28);
      const lateralOffset = Math.sin(elapsedMilliseconds * 0.004 + particleIndex * 1.73) * drift;
      const flickerAmount = 1 - flicker + flicker * (0.5 + 0.5 * Math.sin(elapsedMilliseconds * 0.025 + particleIndex));
      const x = from.x + dx * segmentProgress + normalX * lateralOffset;
      const y = from.y + dy * segmentProgress + normalY * lateralOffset;

      context.save();
      context.translate(x, y);
      if (definition.rotateToPath) {
        context.rotate(angle - Math.PI / 2);
      }
      context.globalAlpha = opacity * flickerAmount;
      context.drawImage(image, -size / 2, -size / 2, size, size);
      context.restore();
    }
  });

  context.restore();
}

export function TracksCanvas({
  board,
  puzzle,
  flow,
  crossingGaps,
  assets,
  disabled,
  solutionShown,
  hud,
  onActivate,
  onWheelRotate,
}: TracksCanvasProps) {
  const [particleImage, setParticleImage] = useState<HTMLImageElement | null>(null);
  const particleDefinition = assets.flowParticle;
  const assetUrls = useMemo(
    () => [assets.node, ...(particleDefinition ? [particleDefinition.src] : [])],
    [assets.node, particleDefinition],
  );
  const cells = useMemo(
    () =>
      board.flatMap((rowValues, row) =>
        rowValues.map((mask, col) => {
          const isStart = puzzle.start[0] === row && puzzle.start[1] === col;
          const isEnd = puzzle.end[0] === row && puzzle.end[1] === col;
          return {
            key: positionKey([row, col]),
            row,
            col,
            disabled: disabled || mask === 0 || isStart,
            label: `Row ${row + 1}, column ${col + 1}${
              mask === 0 ? ", empty" : isStart ? ", start track" : isEnd ? ", end track" : ", track piece"
            }`,
          };
        }),
      ),
    [board, disabled, puzzle.end, puzzle.start],
  );

  const geometry = useMemo(
    () => buildGeometry(board, puzzle, flow, crossingGaps),
    [board, crossingGaps, flow, puzzle],
  );

  useEffect(() => {
    if (!particleDefinition) {
      setParticleImage(null);
      return;
    }

    let cancelled = false;
    const image = new Image();
    setParticleImage(null);
    image.decoding = "async";
    image.onload = () => {
      if (!cancelled) {
        setParticleImage(image);
      }
    };
    image.src = particleDefinition.src;

    return () => {
      cancelled = true;
    };
  }, [particleDefinition]);

  const draw = useCallback(
    ({ root, textures, host, size, cellWidth, cellHeight }: Parameters<React.ComponentProps<typeof CanvasBoard>["draw"]>[0]) => {
      const cell = cssVar(host, "--cell", "#edf1f3");
      const empty = cssVar(host, "--empty-cell", "#dfe6e9");
      const grid = cssVar(host, "--game-grid", "#626a70");
      const track = cssVar(host, "--track", "#415a66");
      const channel = cssVar(host, "--track-channel", "#b8c4c9");
      const fluid = solutionShown ? cssVar(host, "--gold", "#d3a44a") : cssVar(host, "--flow", "#15967f");
      const start = cssVar(host, "--start", "#3686ae");
      const end = cssVar(host, "--end", "#d85f50");
      const surface = cssVar(host, "--game-surface", "#ffffff");
      const nodeTint = cssVar(host, "--track-node-asset", track);
      const pipeWidth = cellWidth * PIPE_WIDTH_RATIO;
      const channelWidth = cellWidth * CHANNEL_WIDTH_RATIO;
      const fluidWidth = cellWidth * FLUID_WIDTH_RATIO;

      board.forEach((rowValues, row) => {
        rowValues.forEach((mask, col) => {
          const x = col * cellWidth;
          const y = row * cellHeight;
          const centerX = x + cellWidth / 2;
          const centerY = y + cellHeight / 2;
          const isStart = puzzle.start[0] === row && puzzle.start[1] === col;
          const isEnd = puzzle.end[0] === row && puzzle.end[1] === col;
          addRect(root, x, y, cellWidth, cellHeight, mask === 0 ? empty : cell);
          if (isStart || isEnd) {
            addCircle(root, centerX, centerY, cellWidth * 0.34, isStart ? start : end).alpha = 0.13;
          }
        });
      });

      const gridGraphic = new Graphics();
      for (let row = 0; row <= board.length; row += 1) {
        gridGraphic.moveTo(0, row * cellHeight).lineTo(size, row * cellHeight);
      }
      for (let col = 0; col <= board.length; col += 1) {
        gridGraphic.moveTo(col * cellWidth, 0).lineTo(col * cellWidth, size);
      }
      gridGraphic.stroke({ color: grid, width: 2, alpha: 0.24 });
      root.addChild(gridGraphic);

      const pipeSegments = [...geometry.arms, ...geometry.bridges];
      strokeSegments(root, pipeSegments, track, pipeWidth);
      strokeSegments(root, pipeSegments, channel, channelWidth);

      board.forEach((rowValues, row) => {
        rowValues.forEach((mask, col) => {
          if (mask === 0) {
            return;
          }
          const centerX = (col + 0.5) * cellWidth;
          const centerY = (row + 0.5) * cellHeight;
          const node = addSprite(root, textures.get(assets.node), centerX, centerY, cellWidth * 0.23);
          if (node) {
            node.tint = nodeTint;
          } else {
            addCircle(root, centerX, centerY, cellWidth * 0.105, track);
            addCircle(root, centerX, centerY, cellWidth * 0.058, channel);
          }
        });
      });

      const lowerFlow = geometry.flowSegments.filter((segment) => segment.layer !== "overpass");
      const overpassFlow = geometry.flowSegments.filter((segment) => segment.layer === "overpass");
      strokeSegments(root, lowerFlow, fluid, fluidWidth * 1.7, 0.18);
      strokeSegments(root, lowerFlow, fluid, fluidWidth);

      const overpassBridges = geometry.bridges.filter((segment) => segment.layer === "overpass");
      strokeSegments(root, overpassBridges, cell, pipeWidth * 1.42);
      strokeSegments(root, overpassBridges, track, pipeWidth);
      strokeSegments(root, overpassBridges, channel, channelWidth);
      strokeSegments(root, overpassFlow, fluid, fluidWidth * 1.7, 0.18);
      strokeSegments(root, overpassFlow, fluid, fluidWidth);

      addCircle(root, geometry.startPoint.x, geometry.startPoint.y, cellWidth * 0.095, start, {
        color: surface,
        width: 4,
      });
      addCircle(root, geometry.endPoint.x, geometry.endPoint.y, cellWidth * 0.095, end, {
        color: surface,
        width: 4,
      });
      addRect(root, 2, 2, size - 4, size - 4, "transparent", { color: grid, width: 5 }, 4);
    },
    [assets.node, board, geometry, puzzle.end, puzzle.start, solutionShown],
  );

  const animate = useCallback(
    ({ context, host, elapsedMilliseconds, cellWidth }: CanvasBoardAnimationFrame) => {
      if (geometry.flowSegments.length === 0) {
        return;
      }

      const pulse = solutionShown
        ? cssVar(host, "--gold-soft", "#f1dda7")
        : cssVar(host, "--flow-bright", "#73d7c4");
      const glow = solutionShown
        ? cssVar(host, "--gold", "#d3a44a")
        : cssVar(host, "--flow-glow", "rgba(21, 150, 127, 0.42)");
      const start = cssVar(host, "--start", "#3686ae");
      const end = cssVar(host, "--end", "#d85f50");
      const surface = cssVar(host, "--game-surface", "#ffffff");
      const lowerFlow = geometry.flowSegments.filter((segment) => segment.layer !== "overpass");
      const overpassFlow = geometry.flowSegments.filter((segment) => segment.layer === "overpass");

      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = cellWidth * PULSE_WIDTH_RATIO;
      context.strokeStyle = pulse;
      context.shadowColor = glow;
      context.shadowBlur = cellWidth * 0.075;
      context.globalAlpha = particleDefinition?.pulseOpacity ?? 1;
      drawCanvasSegments(context, lowerFlow, elapsedMilliseconds, cellWidth);
      context.globalAlpha = 1;
      if (particleImage && particleDefinition) {
        drawFlowParticles(
          context,
          lowerFlow,
          particleImage,
          particleDefinition,
          elapsedMilliseconds,
          cellWidth,
          glow,
        );
      }

      if (overpassFlow.length > 0) {
        context.save();
        context.globalCompositeOperation = "destination-out";
        context.shadowBlur = 0;
        context.lineWidth = Math.max(
          cellWidth * FLUID_WIDTH_RATIO * 1.35,
          particleDefinition ? cellWidth * particleDefinition.size * 1.2 : 0,
        );
        context.setLineDash([]);
        overpassFlow.forEach(({ from, to }) => {
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(to.x, to.y);
          context.stroke();
        });
        context.restore();
        context.globalAlpha = particleDefinition?.pulseOpacity ?? 1;
        drawCanvasSegments(context, overpassFlow, elapsedMilliseconds, cellWidth);
        context.globalAlpha = 1;
        if (particleImage && particleDefinition) {
          drawFlowParticles(
            context,
            overpassFlow,
            particleImage,
            particleDefinition,
            elapsedMilliseconds,
            cellWidth,
            glow,
          );
        }
      }

      const drawEndpoint = (point: Point, color: string) => {
        context.shadowBlur = 0;
        context.fillStyle = color;
        context.strokeStyle = surface;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(point.x, point.y, cellWidth * 0.095, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      };
      drawEndpoint(geometry.startPoint, start);
      drawEndpoint(geometry.endPoint, end);
      context.restore();
    },
    [geometry, particleDefinition, particleImage, solutionShown],
  );

  return (
    <CanvasBoard
      className="board"
      ariaLabel={`${puzzle.size} by ${puzzle.size} Tracks board`}
      rows={puzzle.size}
      cols={puzzle.size}
      cells={cells}
      assetUrls={assetUrls}
      hud={hud}
      draw={draw}
      animate={animate}
      animationFps={30}
      onCellActivate={onActivate}
      onCellWheel={onWheelRotate}
    />
  );
}
