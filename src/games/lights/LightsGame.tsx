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
  Moon,
  PartyPopper,
  RefreshCcw,
  RotateCcw,
  Sun,
  Trophy,
  Undo2,
  X,
} from "lucide-react";
import { fetchPuzzle } from "./api";
import { useTheme } from "../../useTheme";
import {
  BOARD_SIZES,
  cloneBoard,
  formatTime,
  isSolved,
  litCount,
  positionKey,
  pressCell,
  solveBoard,
} from "./game";
import type { Board, Position, Puzzle } from "./types";

const CONFETTI_COLORS = ["#f3b13e", "#278f83", "#3b79a7", "#d55466", "#263642"];

function solutionSet(solution: Position[] | null): Set<string> {
  return new Set((solution ?? []).map(positionKey));
}

export function LightsGame() {
  const { theme, toggleTheme } = useTheme();
  const [selectedSize, setSelectedSize] = useState(5);
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

  const solved = board.length > 0 && isSolved(board);
  const assisted = solutionRevealed || usedHint;
  const isNewBest = solved && !assisted && (bestTime === null || elapsedSeconds < bestTime);
  const lightsOn = litCount(board);
  const totalCells = selectedSize * selectedSize;
  const currentSolution = useMemo(() => solveBoard(board), [board]);
  const highlightedSolution = useMemo(
    () => solutionSet(showSolution ? currentSolution : null),
    [currentSolution, showSolution],
  );
  const displayedBestTime = isNewBest ? elapsedSeconds : bestTime;

  const initializePuzzle = useCallback((nextPuzzle: Puzzle, size: number) => {
    setSelectedSize(size);
    setPuzzle(nextPuzzle);
    setBoard(cloneBoard(nextPuzzle.board));
    setHistory([]);
    setElapsedSeconds(0);
    setShowSolution(false);
    setSolutionRevealed(false);
    setUsedHint(false);
    const stored = window.localStorage.getItem(`lights-best-${size}`);
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
          setError(requestError instanceof Error ? requestError.message : "Could not load a Lights puzzle.");
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
      void loadPuzzle(5, controller.signal);
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

    window.localStorage.setItem(`lights-best-${selectedSize}`, String(elapsedSeconds));
  }, [elapsedSeconds, isNewBest, selectedSize]);

  const press = (row: number, col: number) => {
    if (!puzzle || showSolution || solved) {
      return;
    }

    setHistory((current) => [...current, cloneBoard(board)]);
    setBoard((current) => pressCell(current, row, col));
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
    setBoard(cloneBoard(puzzle.board));
    setHistory([]);
    setShowSolution(false);
  };

  const revealHint = () => {
    if (!puzzle || showSolution || solved) {
      return;
    }

    const hint = solveBoard(board)?.[0];
    if (!hint) {
      return;
    }

    setHistory((current) => [...current, cloneBoard(board)]);
    setBoard((current) => pressCell(current, hint[0], hint[1]));
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
      <section className="game-surface" aria-label="Lights game">
        <header className="top-bar">
          <div className="brand-lockup">
            <img className="brand-mark asset-mark" src="/games/lights/logo.png" alt="" />
            <h1>Lights</h1>
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
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              aria-pressed={theme === "dark"}
              onClick={toggleTheme}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
            >
              {theme === "dark" ? <Sun aria-hidden="true" size={21} /> : <Moon aria-hidden="true" size={21} />}
            </button>
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
            <span>Lit</span>
            <strong>
              {lightsOn}/{totalCells}
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
                aria-label={`${puzzle.size} by ${puzzle.size} Lights board`}
              >
                {board.map((rowValues, row) =>
                  rowValues.map((value, col) => {
                    const key = positionKey([row, col]);
                    const isSolutionPress = highlightedSolution.has(key);
                    return (
                      <button
                        className={[
                          "cell",
                          value === 1 ? "is-lit" : "is-dark",
                          isSolutionPress ? "is-solution" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        key={key}
                        disabled={showSolution || solved}
                        onClick={() => press(row, col)}
                        aria-label={`Row ${row + 1}, column ${col + 1}: ${value ? "lit" : "dark"}${
                          isSolutionPress ? ", solution press" : ""
                        }`}
                      >
                        <span className="light-core" aria-hidden="true" />
                        {isSolutionPress && <span className="press-dot" aria-hidden="true" />}
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
                        ? "You lit the grid with help, so this run is not saved as a record."
                        : `Every light on in ${formatTime(elapsedSeconds)}.`}
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
          <span style={{ width: `${totalCells === 0 ? 0 : (lightsOn / totalCells) * 100}%` }} />
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
            disabled={!puzzle || isLoading || solved || currentSolution === null}
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
          {solved ? `Puzzle solved in ${formatTime(elapsedSeconds)}` : `${totalCells - lightsOn} lights still off`}
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
          <aside className="rules-panel" aria-label="How to play Lights">
            <div className="rules-heading">
              <div>
                <span>How to play</span>
                <h2>Lights rules</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="lights-legend" aria-label="Light example">
              <span className="legend-light is-lit" />
              <img className="legend-emoji" src="/games/lights/logo.png" alt="" />
              <span className="legend-light" />
            </div>

            <ol className="rules-list">
              <li>
                <strong>Turn every light on</strong>
                <span>The puzzle is solved when the whole board is glowing.</span>
              </li>
              <li>
                <strong>Press one tile</strong>
                <span>A press flips that tile and its up, down, left, and right neighbors.</span>
              </li>
              <li>
                <strong>Plan the ripples</strong>
                <span>Pressing the same tile twice cancels the first press.</span>
              </li>
              <li>
                <strong>Records stay clean</strong>
                <span>Hints and solution reveals make the current run ineligible for a best time.</span>
              </li>
            </ol>
          </aside>
        </>
      )}
    </main>
  );
}
