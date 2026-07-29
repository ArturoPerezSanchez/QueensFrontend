import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  Loader2,
  Medal,
  PartyPopper,
  RefreshCcw,
  RotateCcw,
  ShieldX,
  Trophy,
  X as XIcon,
} from "lucide-react";
import { fetchPuzzle } from "./api";
import { useQueensPatternsSetting } from "../../useConfig";
import { BOARD_SIZES, evaluateGame, formatTime, getForbiddenMarks, positionKey, toPositionSet } from "./game";
import type { Puzzle, ViolationKind } from "./types";

const REGION_STYLES = [
  {
    color: "#f0e442",
    pattern: "linear-gradient(145deg, rgba(255,255,255,.36), rgba(255,255,255,0) 55%)",
    darkPattern: "linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,0) 55%)",
  },
  {
    color: "#56b4e9",
    pattern: "repeating-linear-gradient(45deg, rgba(255,255,255,.28) 0 4px, transparent 4px 12px)",
    darkPattern: "repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 4px, transparent 4px 12px)",
  },
  {
    color: "#009e73",
    pattern: "repeating-linear-gradient(135deg, rgba(255,255,255,.3) 0 3px, transparent 3px 11px)",
    darkPattern: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 3px, transparent 3px 11px)",
  },
  {
    color: "#e69f00",
    pattern: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.34) 0 2px, transparent 2px 11px)",
    darkPattern: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.07) 0 2px, transparent 2px 11px)",
  },
  {
    color: "#0072b2",
    pattern: "repeating-linear-gradient(0deg, rgba(255,255,255,.24) 0 3px, transparent 3px 10px)",
    darkPattern: "repeating-linear-gradient(0deg, rgba(255,255,255,.055) 0 3px, transparent 3px 10px)",
  },
  {
    color: "#cc79a7",
    pattern: "repeating-linear-gradient(90deg, rgba(255,255,255,.24) 0 3px, transparent 3px 10px)",
    darkPattern: "repeating-linear-gradient(90deg, rgba(255,255,255,.055) 0 3px, transparent 3px 10px)",
  },
  {
    color: "#d55e00",
    pattern: "radial-gradient(circle at 70% 34%, rgba(255,255,255,.28) 0 2px, transparent 2px 9px)",
    darkPattern: "radial-gradient(circle at 70% 34%, rgba(255,255,255,.06) 0 2px, transparent 2px 9px)",
  },
  {
    color: "#8da0cb",
    pattern: "repeating-linear-gradient(45deg, rgba(31,41,51,.14) 0 2px, transparent 2px 9px)",
    darkPattern: "repeating-linear-gradient(45deg, rgba(212,212,212,.045) 0 2px, transparent 2px 9px)",
  },
  {
    color: "#66c2a5",
    pattern: "repeating-linear-gradient(135deg, rgba(31,41,51,.12) 0 2px, transparent 2px 8px)",
    darkPattern: "repeating-linear-gradient(135deg, rgba(212,212,212,.04) 0 2px, transparent 2px 8px)",
  },
  {
    color: "#b3b3b3",
    pattern: "linear-gradient(45deg, rgba(255,255,255,.26) 25%, transparent 25% 50%, rgba(31,41,51,.1) 50% 75%, transparent 75%)",
    darkPattern:
      "linear-gradient(45deg, rgba(255,255,255,.055) 25%, transparent 25% 50%, rgba(212,212,212,.035) 50% 75%, transparent 75%)",
  },
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

function getStoredAutoMarkPreference(): boolean {
  return localStorage.getItem("queens-auto-mark") === "true";
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

export function QueensGame() {
  const [size, setSize] = useState(8);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [queens, setQueens] = useState<Set<string>>(() => new Set());
  const [manualMarks, setManualMarks] = useState<Set<string>>(() => new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTimes, setBestTimes] = useState<BestTimes>(() => getStoredBestTimes());
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [showPatterns] = useQueensPatternsSetting();
  const [autoMarkForbidden, setAutoMarkForbidden] = useState(() => getStoredAutoMarkPreference());
  const [showRules, setShowRules] = useState(false);
  const [showConflictPanel, setShowConflictPanel] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const suppressClickKey = useRef<string | null>(null);
  const isMarkDragging = useRef(false);
  const markDragMode = useRef<"add" | "remove" | null>(null);
  const draggedMarkKeys = useRef<Set<string>>(new Set());
  const suppressNextContextMenu = useRef(false);

  const gameStatus = useMemo(
    () => (puzzle ? evaluateGame(puzzle.board, queens) : null),
    [puzzle, queens],
  );
  const hasConflicts = Boolean(gameStatus && gameStatus.conflicts.size > 0);
  const activeViolations = gameStatus
    ? (Object.keys(gameStatus.violations) as ViolationKind[]).filter((kind) => gameStatus.violations[kind] > 0)
    : [];
  const solutionCells = useMemo(() => toPositionSet(puzzle?.solution ?? null), [puzzle?.solution]);
  const forbiddenMarks = useMemo(
    () => (puzzle && autoMarkForbidden ? getForbiddenMarks(puzzle.board, queens) : new Set<string>()),
    [autoMarkForbidden, puzzle, queens],
  );
  const marks = useMemo(() => {
    const next = new Set([...manualMarks, ...forbiddenMarks]);

    for (const queen of queens) {
      next.delete(queen);
    }

    return next;
  }, [forbiddenMarks, manualMarks, queens]);
  const bestTime = bestTimes[String(size)];

  const loadPuzzle = useCallback(async (nextSize: number, signal?: AbortSignal) => {
    setLoadState("loading");
    setError(null);
    setShowSolution(false);
    setSolutionRevealed(false);
    setShowConflictPanel(false);

    try {
      const nextPuzzle = await fetchPuzzle(nextSize, signal);
      setPuzzle(nextPuzzle);
      setQueens(new Set());
      setManualMarks(new Set());
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
    if (!puzzle || gameStatus?.isSolved || loadState !== "ready" || solutionRevealed) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameStatus?.isSolved, loadState, puzzle, solutionRevealed]);

  useEffect(() => {
    if (!gameStatus?.isSolved || solutionRevealed) {
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
  }, [elapsedSeconds, gameStatus?.isSolved, size, solutionRevealed]);

  useEffect(() => {
    localStorage.setItem("queens-auto-mark", String(autoMarkForbidden));
  }, [autoMarkForbidden]);

  useEffect(() => {
    if (!hasConflicts) {
      setShowConflictPanel(false);
    }
  }, [hasConflicts]);

  const finishMarkDrag = useCallback(() => {
    isMarkDragging.current = false;
    markDragMode.current = null;
    draggedMarkKeys.current.clear();
  }, []);

  useEffect(() => {
    window.addEventListener("pointerup", finishMarkDrag);
    window.addEventListener("blur", finishMarkDrag);

    return () => {
      window.removeEventListener("pointerup", finishMarkDrag);
      window.removeEventListener("blur", finishMarkDrag);
    };
  }, [finishMarkDrag]);

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
        setManualMarks((currentMarks) => {
          const nextMarks = new Set(currentMarks);
          nextMarks.delete(key);
          return nextMarks;
        });
      }

      return next;
    });
  }

  function toggleMark(row: number, col: number): void {
    if (!puzzle || gameStatus?.isSolved) {
      return;
    }

    const key = positionKey(row, col);
    setQueens((currentQueens) => {
      const nextQueens = new Set(currentQueens);
      nextQueens.delete(key);
      return nextQueens;
    });
    setManualMarks((currentMarks) => {
      const nextMarks = new Set(currentMarks);

      if (nextMarks.has(key)) {
        nextMarks.delete(key);
      } else {
        nextMarks.add(key);
      }

      return nextMarks;
    });
  }

  function setCellMark(row: number, col: number, shouldMark: boolean): void {
    if (!puzzle || gameStatus?.isSolved) {
      return;
    }

    const key = positionKey(row, col);
    setQueens((currentQueens) => {
      if (!currentQueens.has(key)) {
        return currentQueens;
      }

      const nextQueens = new Set(currentQueens);
      nextQueens.delete(key);
      return nextQueens;
    });
    setManualMarks((currentMarks) => {
      if (shouldMark === currentMarks.has(key)) {
        return currentMarks;
      }

      const nextMarks = new Set(currentMarks);

      if (shouldMark) {
        nextMarks.add(key);
      } else {
        nextMarks.delete(key);
      }

      return nextMarks;
    });
  }

  function clearLongPressTimer(): void {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPressMark(event: PointerEvent<HTMLButtonElement>, row: number, col: number): void {
    if (event.pointerType === "mouse") {
      return;
    }

    clearLongPressTimer();
    const key = positionKey(row, col);
    longPressTimer.current = window.setTimeout(() => {
      toggleMark(row, col);
      suppressClickKey.current = key;
      longPressTimer.current = null;
    }, 520);
  }

  function paintDraggedMark(row: number, col: number): void {
    if (!markDragMode.current) {
      return;
    }

    const key = positionKey(row, col);

    if (draggedMarkKeys.current.has(key)) {
      return;
    }

    draggedMarkKeys.current.add(key);
    setCellMark(row, col, markDragMode.current === "add");
  }

  function handleCellPointerDown(event: PointerEvent<HTMLButtonElement>, row: number, col: number): void {
    if (event.pointerType === "mouse" && event.button === 2) {
      event.preventDefault();
      clearLongPressTimer();
      isMarkDragging.current = true;
      suppressNextContextMenu.current = true;
      draggedMarkKeys.current = new Set();
      markDragMode.current = manualMarks.has(positionKey(row, col)) ? "remove" : "add";
      paintDraggedMark(row, col);
      return;
    }

    startLongPressMark(event, row, col);
  }

  function continueMarkDrag(event: PointerEvent<HTMLButtonElement>, row: number, col: number): void {
    if (!isMarkDragging.current || event.pointerType !== "mouse") {
      return;
    }

    event.preventDefault();
    paintDraggedMark(row, col);
  }

  function handleCellPointerLeave(): void {
    if (!isMarkDragging.current) {
      clearLongPressTimer();
    }
  }

  function handleCellClick(row: number, col: number): void {
    const key = positionKey(row, col);

    if (suppressClickKey.current === key) {
      suppressClickKey.current = null;
      return;
    }

    toggleQueen(row, col);
  }

  function handleCellContextMenu(event: MouseEvent<HTMLButtonElement>, row: number, col: number): void {
    event.preventDefault();

    if (suppressNextContextMenu.current) {
      suppressNextContextMenu.current = false;
      return;
    }

    const key = positionKey(row, col);

    if (suppressClickKey.current === key) {
      suppressClickKey.current = null;
      return;
    }

    toggleMark(row, col);
  }

  function retryPuzzle(): void {
    setQueens(new Set());
    setManualMarks(new Set());
    setShowSolution(false);
    setShowConflictPanel(false);
  }

  function requestNewPuzzle(): void {
    void loadPuzzle(size);
  }

  function toggleSolution(): void {
    setShowSolution((current) => {
      if (!current) {
        setSolutionRevealed(true);
      }

      return !current;
    });
  }

  const progress = puzzle && gameStatus ? Math.min(100, Math.round((gameStatus.queenCount / puzzle.size) * 100)) : 0;

  return (
    <main className={`app-shell ${showRules ? "rules-open" : ""}`}>
      <section className="game-surface" aria-label="Queens game">
        <div className="top-bar">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo.png" alt="" />
            </span>
            <div>
              <h1>Queens</h1>
            </div>
          </div>

          <div className="top-actions">
            <div className="size-control" aria-label="Board size">
              <select
                id="board-size"
                aria-label="Board size"
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
              <ChevronDown size={16} aria-hidden="true" />
            </div>

            <button
              className="icon-action"
              type="button"
              aria-label={showRules ? "Hide rules" : "Show rules"}
              aria-pressed={showRules}
              onClick={() => setShowRules((current) => !current)}
            >
              <CircleHelp size={20} />
            </button>
          </div>
        </div>

        <div className="stats-grid" aria-live="polite">
          <div className="stat-tile">
            <span>{solutionRevealed ? "Timer paused" : "Timer"}</span>
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
              className={`board ${showPatterns ? "patterns-enabled" : ""}`}
              style={{ "--board-size": puzzle.size } as CSSProperties}
              aria-label={`${puzzle.size} by ${puzzle.size} Queens board`}
            >
              {puzzle.board.map((row, rowIndex) =>
                row.map((region, colIndex) => {
                  const key = positionKey(rowIndex, colIndex);
                  const hasQueen = queens.has(key);
                  const hasMark = marks.has(key);
                  const isConflict = gameStatus?.conflicts.has(key);
                  const isConflictHint = gameStatus
                    ? (Object.keys(gameStatus.conflictHints) as ViolationKind[]).some((kind) =>
                        gameStatus.conflictHints[kind].has(key),
                      )
                    : false;
                  const isSolution = showSolution && solutionCells.has(key);
                  const regionStyle = REGION_STYLES[Math.abs(region) % REGION_STYLES.length];

                  return (
                    <button
                      className={[
                        "cell",
                        hasQueen ? "has-queen" : "",
                        hasMark ? "has-mark" : "",
                        isConflictHint ? "is-conflict-hint" : "",
                        isConflict ? "is-conflict" : "",
                        isSolution ? "is-solution" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={key}
                      style={
                        {
                          "--region-color": regionStyle.color,
                          "--region-pattern": regionStyle.pattern,
                          "--region-pattern-dark": regionStyle.darkPattern,
                        } as CSSProperties
                      }
                      type="button"
                      aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, region ${region}${
                        hasMark ? ", marked unavailable" : ""
                      }`}
                      aria-pressed={hasQueen}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onContextMenu={(event) => handleCellContextMenu(event, rowIndex, colIndex)}
                      onPointerCancel={() => {
                        clearLongPressTimer();
                        finishMarkDrag();
                      }}
                      onPointerDown={(event) => handleCellPointerDown(event, rowIndex, colIndex)}
                      onPointerEnter={(event) => continueMarkDrag(event, rowIndex, colIndex)}
                      onPointerLeave={handleCellPointerLeave}
                      onPointerMove={(event) => continueMarkDrag(event, rowIndex, colIndex)}
                      onPointerUp={clearLongPressTimer}
                    >
                      {hasQueen && <img className="queen-piece" src="/queen.png" alt="" />}
                      {hasMark && <XIcon className="mark-icon" size={30} strokeWidth={1.45} />}
                      {isSolution && !hasQueen && <img className="solution-piece" src="/queen.png" alt="" />}
                    </button>
                  );
                }),
              )}
            </div>
          )}

          {gameStatus?.isSolved && (
            <div className="win-panel board-win-panel" role="status" aria-live="assertive">
              <div className="confetti-field" aria-hidden="true">
                {Array.from({ length: 18 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
              <PartyPopper size={32} />
              <div>
                <strong>Beautifully done!</strong>
                <p>
                  {solutionRevealed
                    ? "Solution viewed, so this run is not saved as a record."
                    : `You solved the ${size} x ${size} board in ${formatTime(elapsedSeconds)}.`}
                </p>
              </div>
              {!solutionRevealed && bestTime === elapsedSeconds && (
                <span className="record-badge">
                  <Medal size={16} />
                  New best
                </span>
              )}
              <button className="win-action" type="button" onClick={requestNewPuzzle}>
                <RefreshCcw size={17} />
                Play again
              </button>
            </div>
          )}

          {hasConflicts && gameStatus && !gameStatus.isSolved && (
            <button
              className="conflict-trigger"
              type="button"
              aria-label={showConflictPanel ? "Hide board conflicts" : "Show board conflicts"}
              aria-expanded={showConflictPanel}
              onClick={() => setShowConflictPanel((current) => !current)}
            >
              <AlertTriangle size={22} />
            </button>
          )}

          {showConflictPanel && hasConflicts && gameStatus && (
            <>
              <button
                className="conflict-dismiss-layer"
                type="button"
                aria-label="Close board conflicts"
                onClick={() => setShowConflictPanel(false)}
              />
              <div className="conflict-panel board-conflict-panel" role="dialog" aria-label="Board conflicts">
                <button
                  className="conflict-close"
                  type="button"
                  aria-label="Close board conflicts"
                  onClick={() => setShowConflictPanel(false)}
                >
                  <XIcon size={17} />
                </button>
                <AlertTriangle size={30} />
                <div>
                  <strong>Conflicts</strong>
                  <p>Resolve the highlighted rule{activeViolations.length === 1 ? "" : "s"}.</p>
                </div>
                <div className="conflict-list">
                  {activeViolations.map((kind) => (
                    <span key={kind}>
                      {violationLabel(kind)} {gameStatus.violations[kind]}
                    </span>
                  ))}
                </div>
                <button
                  className="conflict-rules-link"
                  type="button"
                  onClick={() => {
                    setShowConflictPanel(false);
                    setShowRules(true);
                  }}
                >
                  <CircleHelp size={16} />
                  View rules
                </button>
              </div>
            </>
          )}
        </div>

        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="action-row">
          <button className="secondary-action" type="button" onClick={retryPuzzle} disabled={!puzzle}>
            <RotateCcw size={18} />
            Retry
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={toggleSolution}
            disabled={!puzzle?.solution}
          >
            {showSolution ? <EyeOff size={18} /> : <Eye size={18} />}
            {showSolution ? "Hide" : "Solution"}
          </button>
          <button
            className="secondary-action"
            type="button"
            aria-pressed={autoMarkForbidden}
            onClick={() => setAutoMarkForbidden((current) => !current)}
          >
            <ShieldX size={18} />
            Auto X
          </button>
          <button className="primary-action" type="button" onClick={requestNewPuzzle} disabled={loadState === "loading"}>
            <RefreshCcw size={18} />
            New Game
          </button>
        </div>
      </section>

      {showRules && (
      <aside className="side-panel" aria-label="Game summary">
        <div className="summary-block">
          <Trophy size={22} />
          <div>
            <span>Current size</span>
            <strong>{size} x {size}</strong>
          </div>
          <button
            className="icon-action close-rules"
            type="button"
            aria-label="Hide rules"
            onClick={() => setShowRules(false)}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="rules-list">
          <div className="rule-item">
            <strong>One per row</strong>
            <span>Every horizontal row must contain exactly one queen.</span>
          </div>
          <div className="rule-item">
            <strong>One per column</strong>
            <span>Every vertical column must contain exactly one queen.</span>
          </div>
          <div className="rule-item">
            <strong>One per region</strong>
            <span>Each colored area must contain exactly one queen.</span>
          </div>
          <div className="rule-item">
            <strong>No touching</strong>
            <span>Queens cannot touch, including diagonally adjacent cells.</span>
          </div>
          <div className="rule-item">
            <strong>Marking X</strong>
            <span>Right-click or long-press cells to mark places you want to avoid.</span>
          </div>
        </div>
      </aside>
      )}
    </main>
  );
}
