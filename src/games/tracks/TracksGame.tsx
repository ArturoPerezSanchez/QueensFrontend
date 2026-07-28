"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  Lightbulb,
  LoaderCircle,
  PartyPopper,
  RefreshCcw,
  RotateCcw,
  Trophy,
  Undo2,
  X,
} from "lucide-react";
import { fetchPuzzle } from "./api";
import {
  BOARD_SIZES,
  DIRECTION_DELTAS,
  DIRECTIONS,
  EAST,
  NORTH,
  NORTH_EAST,
  NORTH_WEST,
  OPPOSITE_DIRECTIONS,
  SOUTH,
  SOUTH_EAST,
  SOUTH_WEST,
  WEST,
  applyFlowHint,
  boardWithStartAligned,
  cloneBoard,
  formatTime,
  isSolved,
  positionKey,
  rotateCell,
  trackCount,
} from "./game";
import type { Board, Position, Puzzle } from "./types";

const CONFETTI_COLORS = ["#168b83", "#f2ad3f", "#3b79a7", "#d55466", "#263642"];
const DIAGONAL_CROSSING_GAP = 10;
const FLOW_DASH_PERIOD = 30;
const TRACK_CONNECTION_OVERLAP = 1;

type FlowCell = {
  centerPhase: number;
  inbound: number | null;
  outbound: number[];
};

function endpointForDirection(direction: number, extension = 0): [number, number] {
  switch (direction) {
    case NORTH:
      return [50, -extension];
    case NORTH_EAST:
      return [100 + extension, -extension];
    case EAST:
      return [100 + extension, 50];
    case SOUTH_EAST:
      return [100 + extension, 100 + extension];
    case SOUTH:
      return [50, 100 + extension];
    case SOUTH_WEST:
      return [-extension, 100 + extension];
    case WEST:
      return [-extension, 50];
    case NORTH_WEST:
      return [-extension, -extension];
    default:
      return [50, 50];
  }
}

function segmentLengthToCenter(endpoint: [number, number]): number {
  const [edgeX, edgeY] = endpoint;
  return Math.hypot(edgeX - 50, edgeY - 50);
}

function logicalSegmentLength(direction: number): number {
  return segmentLengthToCenter(endpointForDirection(direction));
}

function drawnFlowSegmentLength(direction: number, endpointGap = 0): number {
  return segmentLengthToCenter(endpointWithAxisGap(direction, 5, endpointGap));
}

function isDiagonalDirection(direction: number): boolean {
  return direction === NORTH_EAST || direction === SOUTH_EAST || direction === SOUTH_WEST || direction === NORTH_WEST;
}

function inboundFlowPhase(centerPhase: number, direction: number, endpointGap = 0): number {
  return centerPhase - drawnFlowSegmentLength(direction, endpointGap);
}

function endpointWithVectorGap(direction: number, extension = 0, endpointGap = 0): [number, number] {
  if (endpointGap <= 0) {
    return endpointForDirection(direction, extension);
  }

  const [edgeX, edgeY] = endpointForDirection(direction);
  const dx = edgeX - 50;
  const dy = edgeY - 50;
  const length = Math.hypot(dx, dy) || 1;

  return [
    edgeX - (dx / length) * endpointGap,
    edgeY - (dy / length) * endpointGap,
  ];
}

function endpointWithAxisGap(direction: number, extension = 0, endpointGap = 0): [number, number] {
  if (endpointGap <= 0) {
    return endpointForDirection(direction, extension);
  }

  const [edgeX, edgeY] = endpointForDirection(direction);

  return [
    edgeX === 50 ? edgeX : edgeX + Math.sign(50 - edgeX) * endpointGap,
    edgeY === 50 ? edgeY : edgeY + Math.sign(50 - edgeY) * endpointGap,
  ];
}

function addGapDirection(map: Map<string, Set<number>>, row: number, col: number, direction: number) {
  const key = positionKey([row, col]);
  const directions = map.get(key) ?? new Set<number>();
  directions.add(direction);
  map.set(key, directions);
}

function diagonalCrossingGaps(board: Board): Map<string, Set<number>> {
  const gaps = new Map<string, Set<number>>();
  const size = board.length;

  for (let row = 1; row < size; row += 1) {
    for (let col = 1; col < size; col += 1) {
      const topLeft = board[row - 1][col - 1];
      const topRight = board[row - 1][col];
      const bottomLeft = board[row][col - 1];
      const bottomRight = board[row][col];
      const northWestToSouthEast = Boolean((topLeft & SOUTH_EAST) && (bottomRight & NORTH_WEST));
      const northEastToSouthWest = Boolean((topRight & SOUTH_WEST) && (bottomLeft & NORTH_EAST));

      if (northWestToSouthEast && northEastToSouthWest) {
        addGapDirection(gaps, row - 1, col, SOUTH_WEST);
        addGapDirection(gaps, row, col - 1, NORTH_EAST);
      }
    }
  }

  return gaps;
}

function FlowSegment({
  direction,
  endpointGap = 0,
  phase,
  reverse = false,
}: {
  direction: number;
  endpointGap?: number;
  phase: number;
  reverse?: boolean;
}) {
  const [edgeX, edgeY] = endpointWithAxisGap(direction, 5, endpointGap);
  const style = { "--flow-phase": `${phase % FLOW_DASH_PERIOD}px` } as CSSProperties;

  return reverse ? (
    <line style={style} x1={edgeX} y1={edgeY} x2="50" y2="50" />
  ) : (
    <line style={style} x1="50" y1="50" x2={edgeX} y2={edgeY} />
  );
}

function TrackSegments({
  buttDirections,
  buttOverlap = 0,
  extend = 0,
  gapDirections,
  gapMode = "vector",
  mask,
}: {
  buttDirections?: ReadonlySet<number>;
  buttOverlap?: number;
  extend?: number;
  gapDirections?: ReadonlySet<number>;
  gapMode?: "axis" | "vector";
  mask: number;
}) {
  const segmentDirections = DIRECTIONS.filter((direction) => Boolean(mask & direction)).sort((first, second) => {
    const firstHasFluid = buttDirections?.has(first) ? 0 : 1;
    const secondHasFluid = buttDirections?.has(second) ? 0 : 1;
    return firstHasFluid - secondHasFluid;
  });

  return (
    <>
      {segmentDirections.map((direction) => {
        const hasEndpointGap = Boolean(gapDirections?.has(direction));
        const hasButtCap = Boolean(buttDirections?.has(direction)) || hasEndpointGap;
        const overlap = hasButtCap && !hasEndpointGap ? buttOverlap : 0;
        const endpoint = gapMode === "axis" ? endpointWithAxisGap : endpointWithVectorGap;
        const [x2, y2] = endpoint(direction, extend + overlap, hasEndpointGap ? DIAGONAL_CROSSING_GAP : 0);
        const className = hasButtCap ? "is-butt" : undefined;

        return (
          <line
            className={className}
            key={direction}
            x1="50"
            y1="50"
            x2={x2}
            y2={y2}
          />
        );
      })}
    </>
  );
}

function TrackGlyph({ flow, gapDirections, mask }: { flow?: FlowCell; gapDirections?: ReadonlySet<number>; mask: number }) {
  const tubeNodeGradientId = `track-node-gradient-${useId().replace(/:/g, "")}`;
  const fluidDirections = new Set([
    ...(flow?.inbound === null || flow?.inbound === undefined ? [] : [flow.inbound]),
    ...(flow?.outbound ?? []),
  ]);
  const diagonalJointDirections = [...fluidDirections].filter(
    (direction) => isDiagonalDirection(direction) && !gapDirections?.has(direction),
  );
  const gapForDirection = (direction: number) => (gapDirections?.has(direction) ? DIAGONAL_CROSSING_GAP : 0);

  return (
    <svg className={`track-glyph ${flow ? "has-fluid" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={tubeNodeGradientId} cx="36%" cy="32%" r="72%">
          <stop offset="0%" stopColor="var(--track-node-center)" />
          <stop offset="56%" stopColor="var(--track-node-mid)" />
          <stop offset="100%" stopColor="var(--track-node-rim)" />
        </radialGradient>
      </defs>
      <g className="track-tube">
        <TrackSegments
          buttDirections={fluidDirections}
          buttOverlap={TRACK_CONNECTION_OVERLAP}
          gapDirections={gapDirections}
          mask={mask}
        />
        {mask !== 0 && <circle cx="50" cy="50" fill={`url(#${tubeNodeGradientId})`} r="10" />}
      </g>
      <g className="track-fluid">
        {flow ? (
          <>
            {flow.inbound !== null && (
              <FlowSegment
                direction={flow.inbound}
                endpointGap={gapForDirection(flow.inbound)}
                phase={inboundFlowPhase(flow.centerPhase, flow.inbound, gapForDirection(flow.inbound))}
                reverse
              />
            )}
            {flow.outbound.map((direction) => (
              <FlowSegment
                direction={direction}
                endpointGap={gapForDirection(direction)}
                key={direction}
                phase={flow.centerPhase}
              />
            ))}
            {diagonalJointDirections.map((direction) => {
              const [cx, cy] = endpointForDirection(direction);
              return <circle className="flow-joint" cx={cx} cy={cy} key={`joint-${direction}`} r="6" />;
            })}
          </>
        ) : (
          <TrackSegments extend={5} gapDirections={gapDirections} gapMode="axis" mask={mask} />
        )}
        {mask !== 0 && <circle cx="50" cy="50" r="6" />}
      </g>
    </svg>
  );
}

function connectedFlowMap(board: Board, start: Position): Map<string, FlowCell> {
  const size = board.length;
  const flow = new Map<string, FlowCell>();
  if (
    size === 0 ||
    start[0] < 0 ||
    start[1] < 0 ||
    start[0] >= size ||
    start[1] >= size ||
    board[start[0]][start[1]] === 0
  ) {
    return flow;
  }

  const queue: Array<{ centerPhase: number; inbound: number | null; position: Position }> = [
    { centerPhase: 0, inbound: null, position: start },
  ];
  const seen = new Set<string>();

  while (queue.length) {
    const { centerPhase, inbound, position } = queue.shift()!;
    const key = positionKey(position);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const [row, col] = position;
    const mask = board[row][col];
    const outbound: number[] = [];

    for (const direction of DIRECTIONS) {
      if (!(mask & direction) || direction === inbound) {
        continue;
      }

      const [dr, dc] = DIRECTION_DELTAS[direction];
      const neighbor: Position = [row + dr, col + dc];
      if (
        neighbor[0] < 0 ||
        neighbor[1] < 0 ||
        neighbor[0] >= size ||
        neighbor[1] >= size
      ) {
        continue;
      }

      const neighborMask = board[neighbor[0]][neighbor[1]];
      if (!(neighborMask & OPPOSITE_DIRECTIONS[direction])) {
        continue;
      }

      outbound.push(direction);
      queue.push({
        centerPhase:
          centerPhase +
          logicalSegmentLength(direction) +
          logicalSegmentLength(OPPOSITE_DIRECTIONS[direction]),
        inbound: OPPOSITE_DIRECTIONS[direction],
        position: neighbor,
      });
    }

    flow.set(key, { centerPhase, inbound, outbound });
  }

  return flow;
}

export function TracksGame() {
  const [selectedSize, setSelectedSize] = useState(7);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [board, setBoard] = useState<Board>([]);
  const [history, setHistory] = useState<Board[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  const requestSequenceRef = useRef(0);

  const solved = Boolean(puzzle && isSolved(board, puzzle));
  const assisted = solutionRevealed || usedHint;
  const isNewBest = solved && !assisted && (bestTime === null || elapsedSeconds < bestTime);
  const totalTracks = puzzle ? trackCount(puzzle.solution) : 0;
  const displayedBoard = showSolution && puzzle ? puzzle.solution : board;
  const connectedFlow = useMemo(
    () => (puzzle ? connectedFlowMap(displayedBoard, puzzle.start) : new Map<string, FlowCell>()),
    [displayedBoard, puzzle],
  );
  const crossingGaps = useMemo(() => diagonalCrossingGaps(displayedBoard), [displayedBoard]);
  const connectedTracks = connectedFlow;
  const displayedBestTime = isNewBest ? elapsedSeconds : bestTime;

  const initializePuzzle = useCallback((nextPuzzle: Puzzle, size: number) => {
    setSelectedSize(size);
    setPuzzle(nextPuzzle);
    setBoard(boardWithStartAligned(nextPuzzle));
    setHistory([]);
    setElapsedSeconds(0);
    setShowSolution(false);
    setSolutionRevealed(false);
    setUsedHint(false);
    const stored = window.localStorage.getItem(`tracks-best-${size}`);
    setBestTime(stored ? Number(stored) : null);
  }, []);

  const loadPuzzle = useCallback(
    async (size: number, signal?: AbortSignal) => {
      const requestSequence = ++requestSequenceRef.current;
      setIsLoading(true);
      setError(null);
      setPuzzle(null);
      setBoard([]);
      setHistory([]);

      try {
        const nextPuzzle = await fetchPuzzle(size, signal);
        if (requestSequence === requestSequenceRef.current) {
          initializePuzzle(nextPuzzle, size);
        }
      } catch (requestError) {
        if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
          setError(requestError instanceof Error ? requestError.message : "Could not load a Tracks puzzle.");
        }
      } finally {
        if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
          setIsLoading(false);
        }
      }
    },
    [initializePuzzle],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadPuzzle(7, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadPuzzle]);

  useEffect(() => {
    if (!puzzle || isLoading || solved || solutionRevealed) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLoading, puzzle, solutionRevealed, solved]);

  useEffect(() => {
    if (!isNewBest) {
      return;
    }

    window.localStorage.setItem(`tracks-best-${selectedSize}`, String(elapsedSeconds));
  }, [elapsedSeconds, isNewBest, selectedSize]);

  const rotate = (row: number, col: number) => {
    if (
      !puzzle ||
      showSolution ||
      solved ||
      board[row][col] === 0 ||
      (puzzle.start[0] === row && puzzle.start[1] === col)
    ) {
      return;
    }

    setHistory((current) => [...current, cloneBoard(board)]);
    setBoard((current) => rotateCell(current, row, col));
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || showSolution || solved) {
      return;
    }
    setBoard(previous);
    setHistory((current) => current.slice(0, -1));
  };

  const retry = () => {
    if (!puzzle) {
      return;
    }
    setBoard(boardWithStartAligned(puzzle));
    setHistory([]);
    setShowSolution(false);
  };

  const revealHint = () => {
    if (!puzzle || showSolution || solved) {
      return;
    }

    setHistory((current) => [...current, cloneBoard(board)]);
    setBoard((current) => applyFlowHint(current, puzzle));
    setUsedHint(true);
  };

  const toggleSolution = () => {
    if (!puzzle || solved) {
      return;
    }
    if (!showSolution) {
      setSolutionRevealed(true);
    }
    setShowSolution((current) => !current);
  };

  const changeSize = (size: number) => {
    setSelectedSize(size);
    void loadPuzzle(size);
  };

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="Tracks game">
        <header className="top-bar">
          <div className="brand-lockup">
            <img className="brand-mark asset-mark" src="/games/tracks/logo.png" alt="" />
            <h1>Tracks</h1>
          </div>

          <div className="top-actions">
            <label className="size-control">
              <span className="sr-only">Board size</span>
              <select
                value={selectedSize}
                onChange={(event) => changeSize(Number(event.target.value))}
                disabled={isLoading}
              >
                {BOARD_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} x {size}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </label>
            <button
              className="icon-action"
              type="button"
              aria-label="Open game rules"
              aria-expanded={showRules}
              onClick={() => setShowRules(true)}
              title="Rules"
            >
              <CircleHelp aria-hidden="true" size={21} />
            </button>
          </div>
        </header>

        <div className="stats-bar" aria-label="Game progress">
          <div className="stat">
            <span>{solutionRevealed ? "Timer paused" : "Timer"}</span>
            <strong>{formatTime(elapsedSeconds)}</strong>
          </div>
          <div className="stat">
            <span>Best</span>
            <strong>{displayedBestTime === null ? "--:--" : formatTime(displayedBestTime)}</strong>
          </div>
          <div className="stat">
            <span>Flow</span>
            <strong>
              {connectedTracks.size}/{totalTracks}
            </strong>
          </div>
        </div>

        <div className="board-zone">
          {isLoading ? (
            <div className="state-panel" role="status">
              <LoaderCircle className="spin" aria-hidden="true" size={30} />
              <strong>Creating your puzzle</strong>
            </div>
          ) : error || !puzzle ? (
            <div className="state-panel error-state" role="alert">
              <AlertTriangle aria-hidden="true" size={30} />
              <strong>Could not load the board</strong>
              <p>{error}</p>
              <button className="primary-action" type="button" onClick={() => void loadPuzzle(selectedSize)}>
                <RefreshCcw aria-hidden="true" size={18} />
                Try again
              </button>
            </div>
          ) : (
            <>
              <div
                className={`board ${showSolution ? "is-showing-solution" : ""}`}
                style={{ "--board-size": puzzle.size } as CSSProperties}
                aria-label={`${puzzle.size} by ${puzzle.size} Tracks board`}
              >
                {displayedBoard.map((rowValues, row) =>
                  rowValues.map((mask, col) => {
                    const key = positionKey([row, col]);
                    const isStart = puzzle.start[0] === row && puzzle.start[1] === col;
                    const isEnd = puzzle.end[0] === row && puzzle.end[1] === col;
                    const isEndpoint = isStart || isEnd;
                    const flow = connectedFlow.get(key);
                    const startFlow: FlowCell | undefined =
                      isStart && mask !== 0
                        ? {
                            centerPhase: 0,
                            inbound: null,
                            outbound: DIRECTIONS.filter((direction) => Boolean(mask & direction)),
                          }
                        : undefined;
                    const glyphFlow = startFlow ?? flow;
                    const isConnected = Boolean(glyphFlow);

                    return (
                      <button
                        className={[
                          "cell",
                          mask === 0 ? "is-empty" : "has-track",
                          isConnected ? "is-connected" : "",
                          isEndpoint ? "is-endpoint" : "",
                          isStart ? "is-start" : "",
                          isEnd ? "is-end" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        key={key}
                        disabled={mask === 0 || isStart || showSolution || solved}
                        onClick={() => rotate(row, col)}
                        aria-label={`Row ${row + 1}, column ${col + 1}${
                          mask === 0
                            ? ", empty"
                            : isStart
                              ? ", start track"
                              : isEnd
                                ? ", end track"
                                : ", track piece"
                        }`}
                      >
                        <TrackGlyph flow={glyphFlow} gapDirections={crossingGaps.get(key)} mask={mask} />
                        {isEndpoint && <span className="endpoint-dot" aria-hidden="true" />}
                      </button>
                    );
                  }),
                )}
              </div>

              {solved && (
                <div className="board-popup win-popup" role="dialog" aria-modal="true" aria-label="Puzzle solved">
                  <div className="confetti-field" aria-hidden="true">
                    {Array.from({ length: 18 }, (_, index) => (
                      <span
                        key={index}
                        style={
                          {
                            "--x": `${6 + ((index * 17) % 89)}%`,
                            "--delay": `${(index % 7) * 45}ms`,
                            "--confetti-color": CONFETTI_COLORS[index % CONFETTI_COLORS.length],
                          } as CSSProperties
                        }
                      />
                    ))}
                  </div>
                  <PartyPopper aria-hidden="true" size={28} />
                  <div>
                    <strong>Beautifully done!</strong>
                    <p>
                      {assisted
                        ? "You connected the route with help, so this run is not saved as a record."
                        : `Route connected in ${formatTime(elapsedSeconds)}.`}
                    </p>
                  </div>
                  {isNewBest && (
                    <span className="record-badge">
                      <Trophy aria-hidden="true" size={15} />
                      New best
                    </span>
                  )}
                  <button className="win-action" type="button" onClick={() => void loadPuzzle(selectedSize)}>
                    <RefreshCcw aria-hidden="true" size={18} />
                    Play again
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${totalTracks === 0 ? 0 : (connectedTracks.size / totalTracks) * 100}%` }} />
        </div>

        <div className="action-row" aria-label="Game controls">
          <button className="secondary-action" type="button" onClick={undo} disabled={history.length === 0 || showSolution || solved}>
            <Undo2 aria-hidden="true" size={18} />
            Undo
          </button>
          <button className="secondary-action" type="button" onClick={retry} disabled={!puzzle || isLoading}>
            <RotateCcw aria-hidden="true" size={18} />
            Retry
          </button>
          <button className="secondary-action" type="button" onClick={revealHint} disabled={!puzzle || isLoading || showSolution || solved}>
            <Lightbulb aria-hidden="true" size={18} />
            Hint
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={toggleSolution}
            disabled={!puzzle || isLoading || solved}
            aria-pressed={showSolution}
          >
            {showSolution ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
            Solution
          </button>
          <button className="primary-action" type="button" onClick={() => void loadPuzzle(selectedSize)} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={18} />
            New game
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {solved
            ? `Puzzle solved in ${formatTime(elapsedSeconds)}`
            : `${connectedTracks.size} of ${totalTracks} track pieces connected from the start`}
        </p>
      </section>

      {showRules && (
        <>
          <button
            className="rules-backdrop"
            type="button"
            aria-label="Close game rules"
            onClick={() => setShowRules(false)}
          />
          <aside className="rules-panel" aria-label="How to play Tracks">
            <div className="rules-heading">
              <div>
                <span>How to play</span>
                <h2>Tracks rules</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="track-legend" aria-label="Track example">
              <TrackGlyph mask={EAST} />
              <TrackGlyph mask={NORTH_EAST | SOUTH_WEST} />
              <TrackGlyph mask={WEST | SOUTH_EAST} />
            </div>

            <ol className="rules-list">
              <li>
                <strong>Connect the endpoints</strong>
                <span>Make one continuous route between the two marked pieces.</span>
              </li>
              <li>
                <strong>Rotate pieces</strong>
                <span>Tap any track tile to turn it clockwise.</span>
              </li>
              <li>
                <strong>No loose ends</strong>
                <span>Every track opening should meet another track opening.</span>
              </li>
              <li>
                <strong>Records stay clean</strong>
                <span>Hints and solution reveals make the current run ineligible for a best time.</span>
              </li>
            </ol>

            <div className="rules-note">
              <img className="rules-note-asset" src="/games/tracks/logo.png" alt="" />
              <p>The animated flow shows the route currently connected from the start.</p>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
