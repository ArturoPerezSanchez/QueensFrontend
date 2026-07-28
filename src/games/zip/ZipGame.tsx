"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  createInitialPath,
  formatTime,
  isSolved,
  pathPoints,
  positionKey,
  samePosition,
  solutionPrefixWithHint,
  tryStep,
} from "./game";
import type { InvalidMove, Position, Puzzle, Wall } from "./types";

const CONFETTI_COLORS = ["#f28c28", "#f0ad3d", "#3977a8", "#d65b5b", "#263642"];

function wallKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function invalidMoveCopy(move: InvalidMove): { title: string; description: string } {
  switch (move.kind) {
    case "wall":
      return {
        title: "A wall is in the way",
        description: "Continue from the path endpoint without crossing the dark divider.",
      };
    case "visited":
      return {
        title: "That square is already used",
        description: "Tap a square already in the path to rewind to that point.",
      };
    case "clue-order":
      return {
        title: "Follow the numbers",
        description: `Reach ${move.expectedClue} before entering ${move.actualClue}.`,
      };
    case "finish-too-soon":
      return {
        title: "Save the last number for the end",
        description: `Fill every other square before entering ${move.actualClue}.`,
      };
    default:
      return {
        title: "Continue from the endpoint",
        description: "Move one square horizontally or vertically from the end of your path.",
      };
  }
}

function cellFromPointer(event: ReactPointerEvent<HTMLElement>): Position | null {
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>("[data-row][data-col]");
  if (!target) {
    return null;
  }

  return [Number(target.dataset.row), Number(target.dataset.col)];
}

export function ZipGame() {
  const [selectedSize, setSelectedSize] = useState(6);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [path, setPath] = useState<Position[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [invalidMove, setInvalidMove] = useState<InvalidMove | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  const pathRef = useRef<Position[]>([]);
  const drawingRef = useRef(false);
  const completedRef = useRef(false);
  const requestSequenceRef = useRef(0);

  const solved = Boolean(puzzle && isSolved(path, puzzle));
  const assisted = solutionRevealed || usedHint;
  const totalCells = selectedSize * selectedSize;
  const displayedBestTime = isNewBest ? elapsedSeconds : bestTime;
  const progress = totalCells === 0 ? 0 : (path.length / totalCells) * 100;

  const setCurrentPath = useCallback((nextPath: Position[]) => {
    pathRef.current = nextPath;
    setPath(nextPath);
  }, []);

  const initializePuzzle = useCallback(
    (nextPuzzle: Puzzle, size: number) => {
      const initialPath = createInitialPath(nextPuzzle);
      setSelectedSize(size);
      setPuzzle(nextPuzzle);
      setCurrentPath(initialPath);
      setElapsedSeconds(0);
      setShowSolution(false);
      setSolutionRevealed(false);
      setUsedHint(false);
      setIsNewBest(false);
      completedRef.current = false;
      const stored = window.localStorage.getItem(`zip-best-${size}`);
      setBestTime(stored ? Number(stored) : null);
    },
    [setCurrentPath],
  );

  const loadPuzzle = useCallback(
    async (size: number, signal?: AbortSignal) => {
      const requestSequence = ++requestSequenceRef.current;
      setIsLoading(true);
      setError(null);
      setInvalidMove(null);
      setShowConflict(false);
      setPuzzle(null);
      setCurrentPath([]);
      setElapsedSeconds(0);
      setBestTime(null);
      setShowSolution(false);
      setSolutionRevealed(false);
      setUsedHint(false);
      setIsNewBest(false);
      completedRef.current = false;

      try {
        const nextPuzzle = await fetchPuzzle(size, signal);
        if (requestSequence !== requestSequenceRef.current) {
          return;
        }
        initializePuzzle(nextPuzzle, size);
      } catch (requestError) {
        if (signal?.aborted || requestSequence !== requestSequenceRef.current) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "Could not load a Zip puzzle.");
      } finally {
        if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
          setIsLoading(false);
        }
      }
    },
    [initializePuzzle, setCurrentPath],
  );

  useEffect(() => {
    const controller = new AbortController();
    const requestSequence = ++requestSequenceRef.current;
    fetchPuzzle(6, controller.signal)
      .then((nextPuzzle) => {
        if (requestSequence === requestSequenceRef.current) {
          initializePuzzle(nextPuzzle, 6);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted && requestSequence === requestSequenceRef.current) {
          setError(requestError instanceof Error ? requestError.message : "Could not load a Zip puzzle.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestSequence === requestSequenceRef.current) {
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [initializePuzzle]);

  useEffect(() => {
    if (!puzzle || isLoading || solved || solutionRevealed) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLoading, puzzle, solutionRevealed, solved]);

  const wallDirections = useMemo(() => {
    const map = new Map<string, Set<Wall["direction"]>>();
    for (const wall of puzzle?.walls ?? []) {
      const key = wallKey(wall.row, wall.col);
      const directions = map.get(key) ?? new Set<Wall["direction"]>();
      directions.add(wall.direction);
      map.set(key, directions);
    }
    return map;
  }, [puzzle]);

  const displayedPath = showSolution && puzzle ? puzzle.solution : path;
  const visited = useMemo(
    () => new Set(displayedPath.map(positionKey)),
    [displayedPath],
  );
  const endpoint = displayedPath.at(-1);
  const moveCopy = invalidMove ? invalidMoveCopy(invalidMove) : null;

  const attemptTarget = useCallback(
    (target: Position, options: { allowRewind: boolean }) => {
      if (!puzzle || showSolution || isSolved(pathRef.current, puzzle)) {
        return;
      }

      if (!options.allowRewind && pathRef.current.some((position) => samePosition(position, target))) {
        return;
      }

      const result = tryStep(pathRef.current, target, puzzle);
      if (!result.accepted) {
        setInvalidMove(result.error);
        setShowConflict(false);
        return;
      }

      if (result.changed) {
        setCurrentPath(result.path);
        setInvalidMove(null);
        setShowConflict(false);

        if (isSolved(result.path, puzzle) && !assisted && !completedRef.current) {
          completedRef.current = true;
          if (bestTime === null || elapsedSeconds < bestTime) {
            window.localStorage.setItem(`zip-best-${selectedSize}`, String(elapsedSeconds));
            setBestTime(elapsedSeconds);
            setIsNewBest(true);
          }
        }
      }
    },
    [
      assisted,
      bestTime,
      elapsedSeconds,
      puzzle,
      selectedSize,
      setCurrentPath,
      showSolution,
    ],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = cellFromPointer(event);
    if (!target) {
      return;
    }

    event.preventDefault();
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    attemptTarget(target, { allowRewind: true });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) {
      return;
    }

    event.preventDefault();
    const target = cellFromPointer(event);
    if (target) {
      attemptTarget(target, { allowRewind: false });
    }
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const undo = () => {
    if (pathRef.current.length <= 1 || showSolution || solved) {
      return;
    }
    setCurrentPath(pathRef.current.slice(0, -1));
    setInvalidMove(null);
    setShowConflict(false);
  };

  const retry = () => {
    if (!puzzle) {
      return;
    }
    setCurrentPath(createInitialPath(puzzle));
    setShowSolution(false);
    setInvalidMove(null);
    setShowConflict(false);
    setIsNewBest(false);
    completedRef.current = false;
  };

  const revealHint = () => {
    if (!puzzle || showSolution || solved) {
      return;
    }

    setCurrentPath(solutionPrefixWithHint(pathRef.current, puzzle.solution));
    setUsedHint(true);
    setInvalidMove(null);
    setShowConflict(false);
  };

  const toggleSolution = () => {
    if (!puzzle || solved) {
      return;
    }
    if (!showSolution) {
      setSolutionRevealed(true);
    }
    setShowSolution((current) => !current);
    setInvalidMove(null);
    setShowConflict(false);
  };

  const changeSize = (size: number) => {
    setSelectedSize(size);
    void loadPuzzle(size);
  };

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="Zip game">
        <header className="top-bar">
          <div className="brand-lockup">
            <img className="brand-mark asset-mark" src="/games/zip/logo.png" alt="" />
            <h1>Zip</h1>
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
            <span>Path</span>
            <strong>
              {path.length}/{totalCells}
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
                aria-label={`${puzzle.size} by ${puzzle.size} Zip board`}
                onContextMenu={(event) => event.preventDefault()}
                onPointerCancel={finishDrawing}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrawing}
              >
                {puzzle.board.map((rowValues, row) =>
                  rowValues.map((clue, col) => {
                    const key = positionKey([row, col]);
                    const directions = wallDirections.get(wallKey(row, col));
                    const isEndpoint = endpoint?.[0] === row && endpoint[1] === col;
                    const isInvalid =
                      !showSolution &&
                      invalidMove?.target[0] === row &&
                      invalidMove.target[1] === col;

                    return (
                      <button
                        className={[
                          "cell",
                          visited.has(key) ? "is-visited" : "",
                          isEndpoint ? "is-endpoint" : "",
                          isInvalid ? "is-invalid" : "",
                          clue !== null ? "has-clue" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        key={key}
                        data-row={row}
                        data-col={col}
                        aria-label={`Row ${row + 1}, column ${col + 1}${
                          clue === null ? "" : `, number ${clue}`
                        }${visited.has(key) ? ", in path" : ""}`}
                        onClick={(event) => {
                          if (event.detail === 0) {
                            attemptTarget([row, col], { allowRewind: true });
                          }
                        }}
                      >
                        {clue !== null && <span className="clue">{clue}</span>}
                        {directions?.has("right") && <span className="wall wall-right" aria-hidden="true" />}
                        {directions?.has("down") && <span className="wall wall-down" aria-hidden="true" />}
                      </button>
                    );
                  }),
                )}

                <svg
                  className={`path-layer ${showSolution ? "solution-path" : ""}`}
                  viewBox={`0 0 ${puzzle.size} ${puzzle.size}`}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="route-gradient"
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1="0"
                      x2={puzzle.size}
                      y2={puzzle.size}
                    >
                      <stop offset="0%" stopColor="#c95615" />
                      <stop offset="45%" stopColor="#f28c28" />
                      <stop offset="72%" stopColor="#f0b33f" />
                      <stop offset="100%" stopColor="#d95f5f" />
                    </linearGradient>
                  </defs>
                  <polyline points={pathPoints(displayedPath)} />
                  {displayedPath.length === 1 && (
                    <circle cx={displayedPath[0][1] + 0.5} cy={displayedPath[0][0] + 0.5} r="0.11" />
                  )}
                </svg>

                {invalidMove && !showSolution && !solved && (
                  <button
                    className="conflict-trigger"
                    type="button"
                    aria-label="Show invalid move details"
                    aria-expanded={showConflict}
                    onClick={() => setShowConflict((current) => !current)}
                    title="Invalid move"
                  >
                    <AlertTriangle aria-hidden="true" size={22} />
                  </button>
                )}
              </div>

              {showConflict && invalidMove && moveCopy && (
                <>
                  <button
                    className="board-dismiss-layer"
                    type="button"
                    aria-label="Close invalid move details"
                    onClick={() => setShowConflict(false)}
                  />
                  <div className="board-popup conflict-popup" role="dialog" aria-modal="true">
                    <button
                      className="popup-close"
                      type="button"
                      aria-label="Close invalid move details"
                      onClick={() => setShowConflict(false)}
                    >
                      <X aria-hidden="true" size={17} />
                    </button>
                    <AlertTriangle aria-hidden="true" size={25} />
                    <div>
                      <strong>{moveCopy.title}</strong>
                      <p>{moveCopy.description}</p>
                    </div>
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => {
                        setShowConflict(false);
                        setShowRules(true);
                      }}
                    >
                      View rules
                    </button>
                  </div>
                </>
              )}

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
                        ? "You completed the path with help, so this run is not saved as a record."
                        : `Every square connected in ${formatTime(elapsedSeconds)}.`}
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
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="action-row" aria-label="Game controls">
          <button
            className="secondary-action"
            type="button"
            onClick={undo}
            disabled={path.length <= 1 || showSolution || solved}
          >
            <Undo2 aria-hidden="true" size={18} />
            Undo
          </button>
          <button className="secondary-action" type="button" onClick={retry} disabled={!puzzle || isLoading}>
            <RotateCcw aria-hidden="true" size={18} />
            Retry
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={revealHint}
            disabled={!puzzle || isLoading || showSolution || solved}
          >
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
            : `${path.length} of ${totalCells} squares connected`}
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
          <aside className="rules-panel" aria-label="How to play Zip">
            <div className="rules-heading">
              <div>
                <span>How to play</span>
                <h2>Zip rules</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="path-legend" aria-label="Path example">
              <span className="legend-number">1</span>
              <span className="legend-line" />
              <span className="legend-number">2</span>
              <span className="legend-line" />
              <span className="legend-number finish">3</span>
            </div>

            <ol className="rules-list">
              <li>
                <strong>Start at 1</strong>
                <span>Your route begins on the first numbered square. Drag from it or tap an adjacent square.</span>
              </li>
              <li>
                <strong>Fill the whole board</strong>
                <span>Build one continuous path that visits every square exactly once.</span>
              </li>
              <li>
                <strong>Follow the numbers</strong>
                <span>Enter numbered squares in ascending order and finish on the highest number.</span>
              </li>
              <li>
                <strong>Move orthogonally</strong>
                <span>Each step goes up, down, left, or right. Diagonal moves are not allowed.</span>
              </li>
              <li>
                <strong>Respect the walls</strong>
                <span>Thick dark dividers block the path. Route around them without crossing.</span>
              </li>
            </ol>

            <div className="rules-note">
              <img className="rules-note-asset" src="/games/zip/logo.png" alt="" />
              <p>Tap any earlier path square to rewind there. Hints and solution reveals make the run ineligible for a best time.</p>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
