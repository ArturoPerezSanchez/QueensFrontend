"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
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
  evaluateGame,
  formatTime,
  nextCellValue,
  positionKey,
} from "./game";
import type { CellValue, Constraint, Puzzle, SymbolValue, ViolationKind } from "./types";

const CONFLICT_LABELS: Record<ViolationKind, string> = {
  balance: "Too many of one symbol",
  triple: "Three matching symbols",
  relation: "Relationship clue",
};

const CONFETTI_COLORS = ["#f2a23a", "#4f8fdc", "#1f9d7a", "#d95d6f", "#263648"];

function SymbolIcon({
  value,
  className = "",
}: {
  value: SymbolValue;
  className?: string;
}) {
  if (value === 1) {
    return <Sun aria-hidden="true" className={`symbol-icon sun-icon ${className}`} strokeWidth={2.4} />;
  }
  return (
    <Moon
      aria-hidden="true"
      className={`symbol-icon moon-icon ${className}`}
      fill="currentColor"
      strokeWidth={2}
    />
  );
}

function constraintKey(constraint: Constraint): string {
  return `${constraint.row}:${constraint.col}:${constraint.direction}`;
}

function metricLabel(count: number): string {
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

export function TangoGame() {
  const { theme, toggleTheme } = useTheme();
  const [selectedSize, setSelectedSize] = useState(6);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [entries, setEntries] = useState<CellValue[][]>([]);
  const [history, setHistory] = useState<CellValue[][][]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [usedHint, setUsedHint] = useState(false);

  const status = useMemo(
    () =>
      puzzle
        ? evaluateGame(entries, puzzle.constraints)
        : {
            isSolved: false,
            filledCount: 0,
            conflicts: new Set<string>(),
            violations: { balance: 0, triple: 0, relation: 0 },
          },
    [entries, puzzle],
  );

  const assisted = solutionRevealed || usedHint;
  const totalCells = selectedSize * selectedSize;
  const isNewBest =
    status.isSolved && !assisted && (bestTime === null || elapsedSeconds < bestTime);
  const displayedBestTime = isNewBest ? elapsedSeconds : bestTime;

  const loadPuzzle = useCallback(async (size: number) => {
    setIsLoading(true);
    setError(null);
    setShowConflicts(false);

    try {
      const nextPuzzle = await fetchPuzzle(size);
      setPuzzle(nextPuzzle);
      setEntries(cloneBoard(nextPuzzle.board));
      setHistory([]);
      setElapsedSeconds(0);
      setShowSolution(false);
      setSolutionRevealed(false);
      setUsedHint(false);
      const stored = window.localStorage.getItem(`tango-best-${size}`);
      setBestTime(stored ? Number(stored) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load a Tango puzzle.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPuzzle(6, controller.signal)
      .then((nextPuzzle) => {
        setPuzzle(nextPuzzle);
        setEntries(cloneBoard(nextPuzzle.board));
        const stored = window.localStorage.getItem("tango-best-6");
        setBestTime(stored ? Number(stored) : null);
      })
      .catch((requestError) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Could not load a Tango puzzle.");
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!puzzle || isLoading || status.isSolved || solutionRevealed) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLoading, puzzle, solutionRevealed, status.isSolved]);

  useEffect(() => {
    if (!status.isSolved || assisted) {
      return;
    }

    if (bestTime === null || elapsedSeconds < bestTime) {
      window.localStorage.setItem(`tango-best-${selectedSize}`, String(elapsedSeconds));
    }
  }, [assisted, bestTime, elapsedSeconds, selectedSize, status.isSolved]);

  const updateCell = (row: number, col: number, reverse = false) => {
    if (!puzzle || puzzle.board[row][col] !== null || showSolution || status.isSolved) {
      return;
    }

    setHistory((current) => [...current, cloneBoard(entries)]);
    setShowConflicts(false);
    setEntries((current) => {
      const next = cloneBoard(current);
      next[row][col] = nextCellValue(next[row][col], reverse);
      return next;
    });
  };

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>, row: number, col: number) => {
    event.preventDefault();
    updateCell(row, col, true);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || showSolution) {
      return;
    }
    setEntries(previous);
    setHistory((current) => current.slice(0, -1));
  };

  const retry = () => {
    if (!puzzle) {
      return;
    }
    setEntries(cloneBoard(puzzle.board));
    setHistory([]);
    setShowSolution(false);
    setShowConflicts(false);
  };

  const revealHint = () => {
    if (!puzzle || showSolution || status.isSolved) {
      return;
    }

    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (puzzle.board[row][col] === null && entries[row][col] !== puzzle.solution[row][col]) {
          setHistory((current) => [...current, cloneBoard(entries)]);
          setEntries((current) => {
            const next = cloneBoard(current);
            next[row][col] = puzzle.solution[row][col];
            return next;
          });
          setUsedHint(true);
          return;
        }
      }
    }
  };

  const toggleSolution = () => {
    if (!puzzle) {
      return;
    }
    if (!showSolution) {
      setSolutionRevealed(true);
    }
    setShowSolution((current) => !current);
    setShowConflicts(false);
  };

  const changeSize = (size: number) => {
    setSelectedSize(size);
    void loadPuzzle(size);
  };

  const relationByCell = useMemo(() => {
    const map = new Map<string, Constraint[]>();
    for (const constraint of puzzle?.constraints ?? []) {
      const key = positionKey(constraint.row, constraint.col);
      map.set(key, [...(map.get(key) ?? []), constraint]);
    }
    return map;
  }, [puzzle]);

  const activeViolations = (Object.entries(status.violations) as Array<[ViolationKind, number]>).filter(
    ([, count]) => count > 0,
  );

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="Tango game">
        <header className="top-bar">
          <div className="brand-lockup">
            <img className="brand-mark asset-mark" src="/games/tango/logo.png" alt="" />
            <h1>Tango</h1>
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
                    {size} × {size}
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
            <span>Timer</span>
            <strong>{formatTime(elapsedSeconds)}</strong>
          </div>
          <div className="stat">
            <span>Best</span>
            <strong>{displayedBestTime === null ? "--:--" : formatTime(displayedBestTime)}</strong>
          </div>
          <div className="stat">
            <span>Filled</span>
            <strong>
              {status.filledCount}/{totalCells}
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
                className="board"
                style={{ "--board-size": puzzle.size } as CSSProperties}
                aria-label={`${puzzle.size} by ${puzzle.size} Tango board`}
              >
                {entries.map((rowValues, row) =>
                  rowValues.map((value, col) => {
                    const key = positionKey(row, col);
                    const given = puzzle.board[row][col] !== null;
                    const displayedValue = showSolution ? puzzle.solution[row][col] : value;
                    const constraints = relationByCell.get(key) ?? [];

                    return (
                      <button
                        className={[
                          "cell",
                          given ? "is-given" : "",
                          status.conflicts.has(key) && !showSolution ? "is-conflict" : "",
                          showSolution && !given ? "is-solution" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        key={key}
                        disabled={given || showSolution}
                        onClick={() => updateCell(row, col)}
                        onContextMenu={(event) => handleContextMenu(event, row, col)}
                        aria-label={`Row ${row + 1}, column ${col + 1}: ${
                          displayedValue === null ? "empty" : displayedValue === 1 ? "sun" : "moon"
                        }${given ? ", given" : ""}`}
                      >
                        {displayedValue !== null && <SymbolIcon value={displayedValue} />}
                        {constraints.map((constraint) => (
                          <span
                            className={`relation-clue ${constraint.direction}`}
                            key={constraintKey(constraint)}
                            aria-hidden="true"
                          >
                            {constraint.relation === "same" ? "=" : "×"}
                          </span>
                        ))}
                      </button>
                    );
                  }),
                )}
              </div>

              {status.conflicts.size > 0 && !status.isSolved && !showSolution && (
                <button
                  className="conflict-trigger"
                  type="button"
                  aria-label="Show rule conflicts"
                  aria-expanded={showConflicts}
                  onClick={() => setShowConflicts((current) => !current)}
                  title="Rule conflicts"
                >
                  <AlertTriangle aria-hidden="true" size={22} />
                </button>
              )}

              {showConflicts && status.conflicts.size > 0 && (
                <>
                  <button
                    className="board-dismiss-layer"
                    type="button"
                    aria-label="Close conflict details"
                    onClick={() => setShowConflicts(false)}
                  />
                  <div className="board-popup conflict-popup" role="dialog" aria-modal="true">
                    <button
                      className="popup-close"
                      type="button"
                      aria-label="Close conflict details"
                      onClick={() => setShowConflicts(false)}
                    >
                      <X aria-hidden="true" size={17} />
                    </button>
                    <AlertTriangle aria-hidden="true" size={25} />
                    <div>
                      <strong>Something does not fit</strong>
                      <p>The striped cells break one of the rules.</p>
                    </div>
                    <div className="conflict-list">
                      {activeViolations.map(([kind, count]) => (
                        <span key={kind}>
                          {CONFLICT_LABELS[kind]} · {metricLabel(count)}
                        </span>
                      ))}
                    </div>
                    <button
                      className="text-action"
                      type="button"
                      onClick={() => {
                        setShowConflicts(false);
                        setShowRules(true);
                      }}
                    >
                      View rules
                    </button>
                  </div>
                </>
              )}

              {status.isSolved && (
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
                        ? "You solved the board with help, so this run is not saved as a record."
                        : `A clean solve in ${formatTime(elapsedSeconds)}.`}
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
          <span style={{ width: `${(status.filledCount / totalCells) * 100}%` }} />
        </div>

        <div className="action-row" aria-label="Game controls">
          <button className="secondary-action" type="button" onClick={undo} disabled={history.length === 0 || showSolution}>
            <Undo2 aria-hidden="true" size={18} />
            Undo
          </button>
          <button className="secondary-action" type="button" onClick={retry} disabled={!puzzle || isLoading}>
            <RotateCcw aria-hidden="true" size={18} />
            Retry
          </button>
          <button className="secondary-action" type="button" onClick={revealHint} disabled={!puzzle || isLoading || showSolution || status.isSolved}>
            <Lightbulb aria-hidden="true" size={18} />
            Hint
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={toggleSolution}
            disabled={!puzzle || isLoading || status.isSolved}
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
          {status.isSolved
            ? `Puzzle solved in ${formatTime(elapsedSeconds)}`
            : `${status.filledCount} of ${totalCells} cells filled`}
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
          <aside className="rules-panel" aria-label="How to play Tango">
            <div className="rules-heading">
              <div>
                <span>How to play</span>
                <h2>Tango rules</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="symbol-legend" aria-label="Game symbols">
              <span>
                <img className="legend-emoji" src="/games/tango/assets/noto-emoji/sun-face.svg" alt="" />
                Sun
              </span>
              <span>
                <img className="legend-emoji" src="/games/tango/assets/noto-emoji/crescent-moon.svg" alt="" />
                Moon
              </span>
            </div>

            <ol className="rules-list">
              <li>
                <strong>Fill every cell</strong>
                <span>Each square must contain either a sun or a moon. Tap a free cell to cycle through both.</span>
              </li>
              <li>
                <strong>Keep the balance</strong>
                <span>Every row and column must contain the same number of suns and moons.</span>
              </li>
              <li>
                <strong>Stop at two</strong>
                <span>Never place three identical symbols consecutively, horizontally or vertically.</span>
              </li>
              <li>
                <strong>Match equals</strong>
                <span>Two cells separated by <b>=</b> must contain the same symbol.</span>
              </li>
              <li>
                <strong>Opposites attract</strong>
                <span>Two cells separated by <b>×</b> must contain different symbols.</span>
              </li>
            </ol>

            <div className="rules-note">
              <Lightbulb aria-hidden="true" size={19} />
              <p>Right-click cycles a cell in reverse. Hints and solution reveals make the current run ineligible for a best time.</p>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
