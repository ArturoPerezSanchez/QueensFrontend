"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  AlertTriangle,
  Asterisk,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  Flag,
  LoaderCircle,
  PartyPopper,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { fetchPuzzle } from "./api";
import {
  BOARD_SIZES,
  MINE,
  createHiddenBoard,
  flagCount,
  formatTime,
  hintCell,
  isSolved,
  positionKey,
  revealCell,
  revealAll,
  revealedSafeCount,
  safeCount,
  toggleFlag,
} from "./game";
import type { Position, Puzzle, VisibilityBoard } from "./types";

const CONFETTI_COLORS = ["#2e6fce", "#e6b65c", "#2f8a63", "#e05d5d", "#242b34"];

function samePosition(first: Position | null, row: number, col: number): boolean {
  return Boolean(first && first[0] === row && first[1] === col);
}

function clueClass(value: number): string {
  return value > 0 ? `clue-${value}` : "";
}

export function MineIslandsGame() {
  const [selectedSize, setSelectedSize] = useState(8);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [visibility, setVisibility] = useState<VisibilityBoard>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [madeMistake, setMadeMistake] = useState(false);
  const [lost, setLost] = useState(false);
  const [pressedMine, setPressedMine] = useState<Position | null>(null);
  const [flagMode, setFlagMode] = useState(false);

  const requestSequenceRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const skipClickRef = useRef<Set<string>>(new Set());

  const solved = Boolean(puzzle && isSolved(puzzle.solution, visibility));
  const assisted = solutionRevealed || usedHint || madeMistake;
  const isNewBest = solved && !assisted && (bestTime === null || elapsedSeconds < bestTime);
  const safeTotal = puzzle ? safeCount(puzzle.solution) : selectedSize * selectedSize;
  const revealedSafe = puzzle ? revealedSafeCount(puzzle.solution, visibility) : 0;
  const flags = flagCount(visibility);
  const displayedBestTime = isNewBest ? elapsedSeconds : bestTime;
  const progress = safeTotal === 0 ? 0 : (revealedSafe / safeTotal) * 100;
  const displayedVisibility = useMemo(
    () => (showSolution && puzzle ? revealAll(visibility) : visibility),
    [puzzle, showSolution, visibility],
  );

  const initializePuzzle = useCallback((nextPuzzle: Puzzle, size: number) => {
    setSelectedSize(size);
    setPuzzle(nextPuzzle);
    setVisibility(createHiddenBoard(size));
    setElapsedSeconds(0);
    setShowSolution(false);
    setSolutionRevealed(false);
    setUsedHint(false);
    setMadeMistake(false);
    setLost(false);
    setPressedMine(null);
    setFlagMode(false);
    const stored = window.localStorage.getItem(`mine-islands-best-${size}`);
    setBestTime(stored ? Number(stored) : null);
  }, []);

  const loadPuzzle = useCallback(
    async (size: number, signal?: AbortSignal) => {
      const requestSequence = ++requestSequenceRef.current;
      setIsLoading(true);
      setError(null);
      setPuzzle(null);
      setVisibility([]);

      try {
        const nextPuzzle = await fetchPuzzle(size, signal);
        if (requestSequence === requestSequenceRef.current) {
          initializePuzzle(nextPuzzle, size);
        }
      } catch (requestError) {
        if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
          setError(requestError instanceof Error ? requestError.message : "Could not load a Mine Islands puzzle.");
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
      void loadPuzzle(8, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadPuzzle]);

  useEffect(() => {
    if (!puzzle || isLoading || solved || solutionRevealed || lost) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLoading, lost, puzzle, solutionRevealed, solved]);

  useEffect(() => {
    if (!isNewBest) {
      return;
    }

    window.localStorage.setItem(`mine-islands-best-${selectedSize}`, String(elapsedSeconds));
  }, [elapsedSeconds, isNewBest, selectedSize]);

  const toggleFlagAt = (row: number, col: number) => {
    if (!puzzle || showSolution || solved || lost) {
      return;
    }
    setVisibility((current) => toggleFlag(current, row, col));
  };

  const revealAt = (row: number, col: number) => {
    if (!puzzle || showSolution || solved || lost) {
      return;
    }

    const result = revealCell(puzzle.solution, visibility, row, col);
    if (!result.changed) {
      return;
    }

    setVisibility(result.visibility);
    if (result.hitMine) {
      setLost(true);
      setMadeMistake(true);
      setPressedMine([row, col]);
    }
  };

  const activateCell = (row: number, col: number) => {
    if (flagMode) {
      toggleFlagAt(row, col);
    } else {
      revealAt(row, col);
    }
  };

  const beginPress = (event: PointerEvent<HTMLButtonElement>, row: number, col: number) => {
    if (event.pointerType === "mouse") {
      return;
    }
    window.clearTimeout(longPressTimerRef.current ?? undefined);
    const key = positionKey([row, col]);
    longPressTimerRef.current = window.setTimeout(() => {
      skipClickRef.current.add(key);
      toggleFlagAt(row, col);
    }, 430);
  };

  const endPress = () => {
    window.clearTimeout(longPressTimerRef.current ?? undefined);
    longPressTimerRef.current = null;
  };

  const retry = () => {
    if (!puzzle) {
      return;
    }
    setVisibility(createHiddenBoard(puzzle.size));
    setShowSolution(false);
    setLost(false);
    setPressedMine(null);
  };

  const revealHint = () => {
    if (!puzzle || showSolution || solved || lost) {
      return;
    }

    const hint = hintCell(puzzle.solution, visibility);
    if (!hint) {
      return;
    }

    const result = revealCell(puzzle.solution, visibility, hint[0], hint[1]);
    setVisibility(result.visibility);
    setUsedHint(true);
  };

  const toggleSolution = () => {
    if (!puzzle || solved) {
      return;
    }
    if (!showSolution) {
      setSolutionRevealed(true);
      setLost(false);
      setPressedMine(null);
    }
    setShowSolution((current) => !current);
  };

  const changeSize = (size: number) => {
    setSelectedSize(size);
    void loadPuzzle(size);
  };

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="Mine Islands game">
        <header className="top-bar">
          <div className="brand-lockup">
            <img className="brand-mark asset-mark" src="/games/mine-islands/logo.svg" alt="" />
            <h1>Mine Islands</h1>
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
            <span>{solutionRevealed || lost ? "Timer paused" : "Timer"}</span>
            <strong>{formatTime(elapsedSeconds)}</strong>
          </div>
          <div className="stat">
            <span>Best</span>
            <strong>{displayedBestTime === null ? "--:--" : formatTime(displayedBestTime)}</strong>
          </div>
          <div className="stat">
            <span>Marked</span>
            <strong>
              {flags}/{puzzle?.mineCount ?? 0}
            </strong>
          </div>
        </div>

        <div className="board-zone">
          {isLoading ? (
            <div className="state-panel" role="status">
              <LoaderCircle className="spin" aria-hidden="true" size={30} />
              <strong>Preparing the board</strong>
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
                className={`board ${showSolution ? "is-showing-solution" : ""} ${lost ? "has-hit-mine" : ""}`}
                style={{ "--board-size": puzzle.size } as CSSProperties}
                aria-label={`${puzzle.size} by ${puzzle.size} Mine Islands board`}
              >
                {puzzle.solution.map((rowValues, row) =>
                  rowValues.map((value, col) => {
                    const key = positionKey([row, col]);
                    const status = displayedVisibility[row][col];
                    const revealMine = lost && value === MINE;
                    const revealed = status === "revealed" || revealMine;
                    const flagged = status === "flagged" && !showSolution;
                    const exploded = samePosition(pressedMine, row, col);
                    const label = revealed
                      ? value === MINE
                        ? "hazard"
                        : value === 0
                          ? "clear"
                          : `${value} touching hazards`
                      : flagged
                        ? "flagged"
                        : "hidden";

                    return (
                      <button
                        className={[
                          "cell",
                          revealed ? "is-revealed" : "is-hidden",
                          flagged ? "is-flagged" : "",
                          value === 0 && revealed ? "is-clear" : "",
                          value > 0 && revealed ? `has-clue ${clueClass(value)}` : "",
                          value === MINE && revealed ? "is-hazard" : "",
                          exploded ? "is-exploded" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        key={key}
                        disabled={showSolution || solved || lost}
                        onClick={() => {
                          if (skipClickRef.current.has(key)) {
                            skipClickRef.current.delete(key);
                            return;
                          }
                          activateCell(row, col);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          toggleFlagAt(row, col);
                        }}
                        onPointerCancel={endPress}
                        onPointerDown={(event) => beginPress(event, row, col)}
                        onPointerLeave={endPress}
                        onPointerUp={endPress}
                        aria-label={`Row ${row + 1}, column ${col + 1}: ${label}`}
                      >
                        {flagged && <Flag className="flag-icon" aria-hidden="true" size={21} />}
                        {revealed && value === MINE && <Asterisk className="hazard-icon" aria-hidden="true" size={27} />}
                        {revealed && value > 0 && <span className="clue">{value}</span>}
                      </button>
                    );
                  }),
                )}
              </div>

              {lost && (
                <div className="board-popup mistake-popup" role="dialog" aria-modal="true" aria-label="Hazard revealed">
                  <Asterisk aria-hidden="true" size={28} />
                  <div>
                    <strong>Hidden hazard found.</strong>
                    <p>Retry keeps the timer running and resets the same board.</p>
                  </div>
                  <button className="win-action" type="button" onClick={retry}>
                    <RotateCcw aria-hidden="true" size={18} />
                    Retry
                  </button>
                </div>
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
                    <strong>Board clear!</strong>
                    <p>
                      {assisted
                        ? "You cleared the map with help, so this run is not saved as a record."
                        : `All safe tiles revealed in ${formatTime(elapsedSeconds)}.`}
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
            onClick={() => setFlagMode((current) => !current)}
            disabled={!puzzle || isLoading || showSolution || solved || lost}
            aria-pressed={flagMode}
          >
            <Flag aria-hidden="true" size={18} />
            Mark
          </button>
          <button className="secondary-action" type="button" onClick={retry} disabled={!puzzle || isLoading}>
            <RotateCcw aria-hidden="true" size={18} />
            Retry
          </button>
          <button className="secondary-action" type="button" onClick={revealHint} disabled={!puzzle || isLoading || showSolution || solved || lost}>
            <ShieldCheck aria-hidden="true" size={18} />
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
            : `${revealedSafe} safe tiles revealed, ${flags} flags placed`}
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
          <aside className="rules-panel" aria-label="How to play Mine Islands">
            <div className="rules-heading">
              <div>
                <span>How to play</span>
                <h2>Mine Islands rules</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="tile-legend" aria-label="Tile examples">
              <span className="legend-cell hidden" aria-label="Hidden tile" />
              <span className="legend-cell clue-example" aria-label="Number clue">3</span>
              <span className="legend-cell hazard" aria-label="Hazard"><Asterisk aria-hidden="true" size={22} /></span>
              <span className="legend-cell flag"><Flag aria-hidden="true" size={18} /></span>
            </div>

            <ol className="rules-list">
              <li>
                <strong>Reveal every safe tile</strong>
                <span>Blank tiles have no nearby hazards; each number counts the hazards touching that tile.</span>
              </li>
              <li>
                <strong>Mark likely hazards</strong>
                <span>Use mark mode, right-click, or long-press to place a flag.</span>
              </li>
              <li>
                <strong>Avoid hidden hazards</strong>
                <span>Revealing one pauses the run; retry keeps the timer.</span>
              </li>
              <li>
                <strong>Records stay clean</strong>
                <span>Hints, solution reveals, and hazard hits make the current run ineligible for a best time.</span>
              </li>
            </ol>
          </aside>
        </>
      )}
    </main>
  );
}
