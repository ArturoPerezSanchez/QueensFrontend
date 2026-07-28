"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

type FlowCell = {
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

function FlowSegment({ direction, reverse = false }: { direction: number; reverse?: boolean }) {
  const [edgeX, edgeY] = endpointForDirection(direction, 5);
  return reverse ? (
    <line x1={edgeX} y1={edgeY} x2="50" y2="50" />
  ) : (
    <line x1="50" y1="50" x2={edgeX} y2={edgeY} />
  );
}

function TrackSegments({ extend = 0, mask }: { extend?: number; mask: number }) {
  const [northX, northY] = endpointForDirection(NORTH, extend);
  const [northEastX, northEastY] = endpointForDirection(NORTH_EAST, extend);
  const [eastX, eastY] = endpointForDirection(EAST, extend);
  const [southEastX, southEastY] = endpointForDirection(SOUTH_EAST, extend);
  const [southX, southY] = endpointForDirection(SOUTH, extend);
  const [southWestX, southWestY] = endpointForDirection(SOUTH_WEST, extend);
  const [westX, westY] = endpointForDirection(WEST, extend);
  const [northWestX, northWestY] = endpointForDirection(NORTH_WEST, extend);

  return (
    <>
      {Boolean(mask & NORTH) && <line x1="50" y1="50" x2={northX} y2={northY} />}
      {Boolean(mask & NORTH_EAST) && <line x1="50" y1="50" x2={northEastX} y2={northEastY} />}
      {Boolean(mask & EAST) && <line x1="50" y1="50" x2={eastX} y2={eastY} />}
      {Boolean(mask & SOUTH_EAST) && <line x1="50" y1="50" x2={southEastX} y2={southEastY} />}
      {Boolean(mask & SOUTH) && <line x1="50" y1="50" x2={southX} y2={southY} />}
      {Boolean(mask & SOUTH_WEST) && <line x1="50" y1="50" x2={southWestX} y2={southWestY} />}
      {Boolean(mask & WEST) && <line x1="50" y1="50" x2={westX} y2={westY} />}
      {Boolean(mask & NORTH_WEST) && <line x1="50" y1="50" x2={northWestX} y2={northWestY} />}
    </>
  );
}

function TrackGlyph({ flow, mask }: { flow?: FlowCell; mask: number }) {
  return (
    <svg className="track-glyph" viewBox="0 0 100 100" aria-hidden="true">
      <g className="track-tube">
        <TrackSegments mask={mask} />
        {mask !== 0 && <circle cx="50" cy="50" r="10" />}
      </g>
      <g className="track-fluid">
        {flow ? (
          <>
            {flow.inbound !== null && <FlowSegment direction={flow.inbound} reverse />}
            {flow.outbound.map((direction) => (
              <FlowSegment direction={direction} key={direction} />
            ))}
          </>
        ) : (
          <TrackSegments extend={5} mask={mask} />
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

  const queue: Array<{ inbound: number | null; position: Position }> = [
    { inbound: null, position: start },
  ];
  const seen = new Set<string>();

  while (queue.length) {
    const { inbound, position } = queue.shift()!;
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
      queue.push({ inbound: OPPOSITE_DIRECTIONS[direction], position: neighbor });
    }

    flow.set(key, { inbound, outbound });
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
                    const isConnected = Boolean(flow);

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
                        <TrackGlyph flow={flow} mask={mask} />
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
