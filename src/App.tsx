import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { fetchPuzzle } from "./api";
import { BOARD_SIZES, evaluateGame, formatTime, positionKey, toPositionSet } from "./game";
import type { Puzzle, ViolationKind } from "./types";

const REGION_COLORS = [
  "#ffd166",
  "#6ec6ff",
  "#ef8fa6",
  "#92d36e",
  "#c7a5ff",
  "#ffad66",
  "#71d6c2",
  "#f2a7e8",
  "#a6b7ff",
  "#d9c76c",
];

type LoadState = "idle" | "loading" | "ready" | "error";

type BestTimes = Record<string, number>;

function getStoredBestTimes(): BestTimes {
  try {
    return JSON.parse(localStorage.getItem("queens-best-times") ?? "{}") as BestTimes;
  } catch {
    return {};
  }
}

function countCompletedGroups(board: number[][], queens: Set<string>): number {
  const usedRegions = new Set<number>();

  for (const key of queens) {
    const [row, col] = key.split(":").map(Number);
    usedRegions.add(board[row][col]);
  }

  return usedRegions.size;
}

function violationLabel(kind: ViolationKind): string {
  const labels: Record<ViolationKind, string> = {
    row: "Rows",
    column: "Columns",
    region: "Regions",
    adjacent: "Touching",
  };

  return labels[kind];
}

export default function App() {
  const [size, setSize] = useState(8);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [queens, setQueens] = useState<Set<string>>(() => new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTimes, setBestTimes] = useState<BestTimes>(() => getStoredBestTimes());
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const gameStatus = useMemo(
    () => (puzzle ? evaluateGame(puzzle.board, queens) : null),
    [puzzle, queens],
  );
  const solutionCells = useMemo(() => toPositionSet(puzzle?.solution ?? null), [puzzle?.solution]);
  const completedRegions = useMemo(
    () => (puzzle ? countCompletedGroups(puzzle.board, queens) : 0),
    [puzzle, queens],
  );
  const bestTime = bestTimes[String(size)];

  const loadPuzzle = useCallback(async (nextSize: number, signal?: AbortSignal) => {
    setLoadState("loading");
    setError(null);
    setShowSolution(false);

    try {
      const nextPuzzle = await fetchPuzzle(nextSize, signal);
      setPuzzle(nextPuzzle);
      setQueens(new Set());
      setElapsedSeconds(0);
      setLoadState("ready");
    } catch (loadError) {
      if (signal?.aborted) {
        return;
      }

      setLoadState("error");
      setError(loadError instanceof Error ? loadError.message : "Could not load a puzzle.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPuzzle(size, controller.signal);

    return () => controller.abort();
  }, [loadPuzzle, size]);

  useEffect(() => {
    if (!puzzle || gameStatus?.isSolved || loadState !== "ready") {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameStatus?.isSolved, loadState, puzzle]);

  useEffect(() => {
    if (!gameStatus?.isSolved) {
      return;
    }

    const storageKey = String(size);
    setBestTimes((current) => {
      if (current[storageKey] !== undefined && current[storageKey] <= elapsedSeconds) {
        return current;
      }

      const next = {
        ...current,
        [storageKey]: elapsedSeconds,
      };
      localStorage.setItem("queens-best-times", JSON.stringify(next));
      return next;
    });
  }, [elapsedSeconds, gameStatus?.isSolved, size]);

  function toggleQueen(row: number, col: number): void {
    if (!puzzle || gameStatus?.isSolved) {
      return;
    }

    const key = positionKey(row, col);
    setQueens((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  function retryPuzzle(): void {
    setQueens(new Set());
    setElapsedSeconds(0);
    setShowSolution(false);
  }

  function requestNewPuzzle(): void {
    void loadPuzzle(size);
  }

  const progress = puzzle && gameStatus ? Math.min(100, Math.round((gameStatus.queenCount / puzzle.size) * 100)) : 0;
  const hasConflicts = Boolean(gameStatus && gameStatus.conflicts.size > 0);

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="Queens game">
        <div className="top-bar">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <Crown size={22} strokeWidth={2.4} />
            </span>
            <div>
              <p className="eyebrow">QueensAPI</p>
              <h1>Queens</h1>
            </div>
          </div>

          <div className="size-control" aria-label="Board size">
            <label htmlFor="board-size">Size</label>
            <select
              id="board-size"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
              disabled={loadState === "loading"}
            >
              {BOARD_SIZES.map((boardSize) => (
                <option key={boardSize} value={boardSize}>
                  {boardSize} x {boardSize}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stats-grid" aria-live="polite">
          <div className="stat-tile">
            <span>Timer</span>
            <strong>{formatTime(elapsedSeconds)}</strong>
          </div>
          <div className="stat-tile">
            <span>Best</span>
            <strong>{bestTime === undefined ? "--:--" : formatTime(bestTime)}</strong>
          </div>
          <div className="stat-tile">
            <span>Queens</span>
            <strong>
              {gameStatus?.queenCount ?? 0}/{puzzle?.size ?? size}
            </strong>
          </div>
          <div className="stat-tile">
            <span>Regions</span>
            <strong>
              {completedRegions}/{puzzle?.size ?? size}
            </strong>
          </div>
        </div>

        <div className="board-zone">
          {loadState === "loading" && (
            <div className="state-panel" role="status">
              <Loader2 className="spin" size={30} />
              <span>Loading puzzle</span>
            </div>
          )}

          {loadState === "error" && (
            <div className="state-panel error-state" role="alert">
              <AlertTriangle size={30} />
              <span>{error}</span>
              <button className="secondary-action" type="button" onClick={requestNewPuzzle}>
                <RefreshCcw size={18} />
                Retry
              </button>
            </div>
          )}

          {puzzle && loadState === "ready" && (
            <div
              className="board"
              style={{ "--board-size": puzzle.size } as CSSProperties}
              aria-label={`${puzzle.size} by ${puzzle.size} Queens board`}
            >
              {puzzle.board.map((row, rowIndex) =>
                row.map((region, colIndex) => {
                  const key = positionKey(rowIndex, colIndex);
                  const hasQueen = queens.has(key);
                  const isConflict = gameStatus?.conflicts.has(key);
                  const isSolution = showSolution && solutionCells.has(key);
                  const color = REGION_COLORS[Math.abs(region) % REGION_COLORS.length];

                  return (
                    <button
                      className={[
                        "cell",
                        hasQueen ? "has-queen" : "",
                        isConflict ? "is-conflict" : "",
                        isSolution ? "is-solution" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={key}
                      style={{ "--region-color": color } as CSSProperties}
                      type="button"
                      aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, region ${region}`}
                      aria-pressed={hasQueen}
                      onClick={() => toggleQueen(rowIndex, colIndex)}
                    >
                      {hasQueen && <Crown className="queen-icon" size={26} strokeWidth={2.6} />}
                      {isSolution && !hasQueen && <Crown className="solution-icon" size={22} strokeWidth={2.5} />}
                    </button>
                  );
                }),
              )}
            </div>
          )}
        </div>

        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="status-strip" aria-live="polite">
          {gameStatus?.isSolved ? (
            <span className="success-message">
              <CheckCircle2 size={18} />
              Solved in {formatTime(elapsedSeconds)}
            </span>
          ) : hasConflicts ? (
            <span className="warning-message">
              <AlertTriangle size={18} />
              Conflicts on the board
            </span>
          ) : (
            <span>
              <Sparkles size={18} />
              {gameStatus?.queenCount ?? 0} placed
            </span>
          )}
        </div>

        {hasConflicts && gameStatus && (
          <div className="violation-row" aria-label="Conflict summary">
            {(Object.keys(gameStatus.violations) as ViolationKind[]).map((kind) => (
              <span className={gameStatus.violations[kind] > 0 ? "active" : ""} key={kind}>
                {violationLabel(kind)} {gameStatus.violations[kind]}
              </span>
            ))}
          </div>
        )}

        <div className="action-row">
          <button className="primary-action" type="button" onClick={requestNewPuzzle} disabled={loadState === "loading"}>
            <RefreshCcw size={18} />
            New
          </button>
          <button className="secondary-action" type="button" onClick={retryPuzzle} disabled={!puzzle}>
            <RotateCcw size={18} />
            Retry
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={() => setShowSolution((current) => !current)}
            disabled={!puzzle?.solution}
          >
            {showSolution ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSolution ? "Hide" : "Solution"}
          </button>
        </div>
      </section>

      <aside className="side-panel" aria-label="Game summary">
        <div className="summary-block">
          <Trophy size={22} />
          <div>
            <span>Current size</span>
            <strong>{size} x {size}</strong>
          </div>
        </div>

        <div className="rules-list">
          <span>One per row</span>
          <span>One per column</span>
          <span>One per region</span>
          <span>No touching</span>
        </div>
      </aside>
    </main>
  );
}
