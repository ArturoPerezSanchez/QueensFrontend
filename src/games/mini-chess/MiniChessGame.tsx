import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  AlertTriangle,
  CircleHelp,
  Lightbulb,
  LoaderCircle,
  PartyPopper,
  RefreshCcw,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { fetchPuzzle } from "./api";
import {
  boardSquares,
  completedSolverMoves,
  formatTime,
  isBottomRank,
  isDarkSquare,
  isExpectedMove,
  isLeftFile,
  legalTargets,
  parseFen,
  pieceAsset,
  pieceLabel,
  sideLabel,
} from "./game";
import type { BoardPiece, LastMove, Puzzle, SquareId } from "./types";

const CONFETTI_COLORS = ["#c6943b", "#47796d", "#cf5b4c", "#385b73", "#efe1c4"];

type PointerDrag = {
  active: boolean;
  pointerId: number;
  square: SquareId;
  piece: BoardPiece;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  size: number;
};

type DragPreview = {
  piece: BoardPiece;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  size: number;
};

export function MiniChessGame() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [ply, setPly] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<SquareId | null>(null);
  const [draggingSquare, setDraggingSquare] = useState<SquareId | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [wrongSquare, setWrongSquare] = useState<SquareId | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [madeMistake, setMadeMistake] = useState(false);

  const requestSequenceRef = useRef(0);
  const replySequenceRef = useRef(0);
  const replyTimerRef = useRef<number | null>(null);
  const wrongTimerRef = useRef<number | null>(null);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const skipClickRef = useRef(false);
  const boardZoneRef = useRef<HTMLDivElement | null>(null);

  const currentState = puzzle?.states[ply] ?? null;
  const pieces = useMemo(
    () => (currentState && puzzle ? parseFen(currentState.fen, puzzle.boardHeight) : new Map()),
    [currentState, puzzle],
  );
  const solved = Boolean(currentState?.isCheckmate && puzzle && ply === puzzle.solution.length);
  const assisted = usedHint || madeMistake;
  const isNewBest = solved && !assisted && (bestTime === null || elapsedSeconds < bestTime);
  const displayedBestTime = isNewBest ? elapsedSeconds : bestTime;
  const completedMoves = completedSolverMoves(ply);
  const progress = puzzle ? Math.min(100, (completedMoves / puzzle.mateIn) * 100) : 0;
  const orientation = puzzle?.sideToMove ?? "white";
  const squares = useMemo(
    () => boardSquares(orientation, puzzle?.boardWidth ?? 8, puzzle?.boardHeight ?? 8),
    [orientation, puzzle?.boardHeight, puzzle?.boardWidth],
  );
  const targets = useMemo(
    () => legalTargets(currentState, selectedSquare),
    [currentState, selectedSquare],
  );
  const checkSquare = currentState?.checkSquare ?? null;

  const stopPendingActions = useCallback(() => {
    replySequenceRef.current += 1;
    window.clearTimeout(replyTimerRef.current ?? undefined);
    window.clearTimeout(wrongTimerRef.current ?? undefined);
    replyTimerRef.current = null;
    wrongTimerRef.current = null;
  }, []);

  const initializePuzzle = useCallback(
    (nextPuzzle: Puzzle) => {
      stopPendingActions();
      setPuzzle(nextPuzzle);
      setPly(0);
      setSelectedSquare(null);
      setDraggingSquare(null);
      setDragPreview(null);
      setLastMove(null);
      setWrongSquare(null);
      setElapsedSeconds(0);
      setIsResponding(false);
      setFeedback(null);
      setUsedHint(false);
      setMadeMistake(false);
      const stored = window.localStorage.getItem(
        `mini-chess-best-${nextPuzzle.variant}-${nextPuzzle.mateIn}`,
      );
      setBestTime(stored ? Number(stored) : null);
    },
    [stopPendingActions],
  );

  const loadPuzzle = useCallback(
    async (signal?: AbortSignal) => {
      const requestSequence = ++requestSequenceRef.current;
      stopPendingActions();
      setIsLoading(true);
      setError(null);
      setPuzzle(null);

      try {
        const nextPuzzle = await fetchPuzzle(signal);
        if (requestSequence === requestSequenceRef.current) {
          initializePuzzle(nextPuzzle);
        }
      } catch (requestError) {
        if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
          setError(requestError instanceof Error ? requestError.message : "Could not load a MiniChess puzzle.");
        }
      } finally {
        if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
          setIsLoading(false);
        }
      }
    },
    [initializePuzzle, stopPendingActions],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadPuzzle(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      stopPendingActions();
    };
  }, [loadPuzzle, stopPendingActions]);

  useEffect(() => {
    if (!puzzle || isLoading || solved) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isLoading, puzzle, solved]);

  useEffect(() => {
    if (!isNewBest || !puzzle) {
      return;
    }
    window.localStorage.setItem(
      `mini-chess-best-${puzzle.variant}-${puzzle.mateIn}`,
      String(elapsedSeconds),
    );
  }, [elapsedSeconds, isNewBest, puzzle]);

  const showWrongMove = (square: SquareId, message: string, countsAsMistake: boolean) => {
    window.clearTimeout(wrongTimerRef.current ?? undefined);
    setWrongSquare(square);
    setFeedback(message);
    if (countsAsMistake) {
      setMadeMistake(true);
    }
    wrongTimerRef.current = window.setTimeout(() => {
      setWrongSquare(null);
      setFeedback(null);
    }, 1100);
  };

  const scheduleReply = (nextPly: number) => {
    if (!puzzle || nextPly >= puzzle.solution.length) {
      return;
    }

    const sequence = ++replySequenceRef.current;
    const reply = puzzle.solution[nextPly];
    setIsResponding(true);
    setFeedback(`${sideLabel(puzzle.states[nextPly].turn)} is replying`);
    replyTimerRef.current = window.setTimeout(() => {
      if (sequence !== replySequenceRef.current) {
        return;
      }

      setPly(nextPly + 1);
      setLastMove({ from: reply.from, to: reply.to });
      setIsResponding(false);
      setFeedback(null);
    }, 520);
  };

  const playSolverMove = (from: SquareId, to: SquareId, fromHint = false) => {
    if (!puzzle || !currentState || solved || isResponding || ply % 2 !== 0) {
      return;
    }

    const expected = puzzle.solution[ply];
    if (!isExpectedMove(from, to, expected)) {
      setSelectedSquare(null);
      showWrongMove(to, "That move does not force the mate.", true);
      return;
    }

    const nextPly = ply + 1;

    if (fromHint) {
      setUsedHint(true);
    }
    setPly(nextPly);
    setSelectedSquare(null);
    setLastMove({ from: expected.from, to: expected.to });
    setFeedback(null);

    if (!puzzle.states[nextPly].isCheckmate) {
      scheduleReply(nextPly);
    }
  };

  const selectOrMove = (square: SquareId) => {
    if (!currentState || !puzzle || solved || isResponding || ply % 2 !== 0) {
      return;
    }

    const piece = pieces.get(square);
    const movingColor = currentState.turn === "white" ? "w" : "b";
    if (!selectedSquare) {
      if (piece?.color === movingColor) {
        setSelectedSquare(square);
        setFeedback(null);
      } else {
        showWrongMove(square, `Choose a ${sideLabel(puzzle.sideToMove)} piece.`, false);
      }
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      setFeedback(null);
      return;
    }

    if (targets.has(square)) {
      playSolverMove(selectedSquare, square);
      return;
    }

    if (piece?.color === movingColor) {
      setSelectedSquare(square);
      setFeedback(null);
      return;
    }

    showWrongMove(square, "That piece cannot move there.", false);
  };

  const beginPointerDrag = (event: PointerEvent<HTMLButtonElement>, square: SquareId) => {
    if (event.button !== 0 || !currentState || !puzzle || solved || isResponding || ply % 2 !== 0) {
      return;
    }

    const piece = pieces.get(square);
    const movingColor = currentState.turn === "white" ? "w" : "b";
    if (piece?.color !== movingColor) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const squareBounds = event.currentTarget.getBoundingClientRect();
    pointerDragRef.current = {
      active: false,
      pointerId: event.pointerId,
      square,
      piece,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - squareBounds.left,
      offsetY: event.clientY - squareBounds.top,
      size: squareBounds.width,
    };
  };

  const movePointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 7) {
      drag.active = true;
      skipClickRef.current = true;
      setSelectedSquare(drag.square);
      setDraggingSquare(drag.square);
      setFeedback(null);
    }

    if (drag.active) {
      const boardZoneBounds = boardZoneRef.current?.getBoundingClientRect();
      setDragPreview({
        piece: drag.piece,
        x: boardZoneBounds ? event.clientX - boardZoneBounds.left : event.clientX,
        y: boardZoneBounds ? event.clientY - boardZoneBounds.top : event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        size: drag.size,
      });
    }
  };

  const endPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pointerDragRef.current;
    pointerDragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId || !drag.active) {
      setDragPreview(null);
      return;
    }

    window.setTimeout(() => {
      skipClickRef.current = false;
    }, 0);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>("[data-square]");
    const square = target?.dataset.square;
    setDraggingSquare(null);
    setDragPreview(null);

    if (!currentState || !square || !legalTargets(currentState, drag.square).has(square)) {
      setSelectedSquare(null);
      showWrongMove(square ?? drag.square, "That piece cannot move there.", false);
      return;
    }

    playSolverMove(drag.square, square);
  };

  const cancelPointerDrag = () => {
    pointerDragRef.current = null;
    setDraggingSquare(null);
    setDragPreview(null);
  };

  const retry = () => {
    if (!puzzle) {
      return;
    }
    stopPendingActions();
    setPly(0);
    setSelectedSquare(null);
    setDraggingSquare(null);
    setDragPreview(null);
    setLastMove(null);
    setWrongSquare(null);
    setIsResponding(false);
    setFeedback(null);
  };

  const hint = () => {
    if (!puzzle || solved || isResponding || ply % 2 !== 0) {
      return;
    }
    const expected = puzzle.solution[ply];
    playSolverMove(expected.from, expected.to, true);
  };

  const statusMessage = solved
    ? "Checkmate"
    : feedback
      ? feedback
      : puzzle
        ? `${sideLabel(puzzle.sideToMove)} to move`
        : "";

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="MiniChess game">
        <header className="top-bar">
          <div className="brand-lockup">
            <span className="brand-mark chess-brand-mark" aria-hidden="true">
              <img src="/games/mini-chess/pieces/bn.svg" alt="" />
            </span>
            <h1>MiniChess</h1>
          </div>

          <div className="top-actions">
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
            <span>Line</span>
            <strong>
              {completedMoves}/{puzzle?.mateIn ?? "-"}
            </strong>
          </div>
        </div>

        <div className="board-zone" ref={boardZoneRef}>
          {isLoading ? (
            <div className="state-panel" role="status">
              <LoaderCircle className="spin" aria-hidden="true" size={30} />
              <strong>Setting the position</strong>
            </div>
          ) : error || !puzzle || !currentState ? (
            <div className="state-panel error-state" role="alert">
              <AlertTriangle aria-hidden="true" size={30} />
              <strong>Could not load the puzzle</strong>
              <p>{error}</p>
              <button className="primary-action" type="button" onClick={() => void loadPuzzle()}>
                <RefreshCcw aria-hidden="true" size={18} />
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="position-strip" aria-live="polite">
                <span className={`side-dot ${puzzle.sideToMove}`} aria-hidden="true" />
                <strong>{statusMessage}</strong>
                <span>Mate in {puzzle.mateIn}</span>
              </div>

              <div
                className={`chess-board ${isResponding ? "is-responding" : ""}`}
                aria-label={`${puzzle.boardWidth} by ${puzzle.boardHeight} MiniChess board, ${sideLabel(puzzle.sideToMove)} to move and mate in ${puzzle.mateIn}`}
                style={
                  {
                    "--board-columns": puzzle.boardWidth,
                  } as CSSProperties
                }
              >
                {squares.map((square) => {
                  const piece = pieces.get(square);
                  const selected = square === selectedSquare;
                  const target = targets.has(square);
                  const last = lastMove?.from === square || lastMove?.to === square;
                  const inCheck = checkSquare === square;
                  const wrong = wrongSquare === square;
                  const label = piece ? `${pieceLabel(piece)} on ${square}` : `Empty ${square}`;

                  return (
                    <button
                      className={[
                        "chess-square",
                        isDarkSquare(square) ? "is-dark" : "is-light",
                        selected ? "is-selected" : "",
                        target ? "is-target" : "",
                        target && piece ? "is-capture-target" : "",
                        last ? "is-last-move" : "",
                        inCheck ? "is-check" : "",
                        wrong ? "is-wrong" : "",
                        draggingSquare === square ? "is-dragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      type="button"
                      key={square}
                      onClick={() => {
                        if (skipClickRef.current) {
                          skipClickRef.current = false;
                          return;
                        }
                        selectOrMove(square);
                      }}
                      onPointerDown={(event) => beginPointerDrag(event, square)}
                      onPointerMove={movePointerDrag}
                      onPointerUp={endPointerDrag}
                      onPointerCancel={cancelPointerDrag}
                      disabled={solved || isResponding}
                      aria-label={label}
                      aria-pressed={selected}
                      data-square={square}
                    >
                      {piece && <img className="chess-piece" src={pieceAsset(piece)} alt="" draggable={false} />}
                      {isLeftFile(square, orientation, puzzle.boardWidth) && (
                        <span className="rank-label">{square.slice(1)}</span>
                      )}
                      {isBottomRank(square, orientation, puzzle.boardHeight) && (
                        <span className="file-label">{square[0]}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {dragPreview && (
                <div
                  className="chess-drag-preview"
                  aria-hidden="true"
                  style={
                    {
                      "--drag-size": `${dragPreview.size}px`,
                      "--drag-x": `${dragPreview.x - dragPreview.offsetX}px`,
                      "--drag-y": `${dragPreview.y - dragPreview.offsetY}px`,
                    } as CSSProperties
                  }
                >
                  <img src={pieceAsset(dragPreview.piece)} alt="" draggable={false} />
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
                    <strong>Checkmate!</strong>
                    <p>
                      {assisted
                        ? "Solved with help, so this run is not saved as a record."
                        : `You found the line in ${formatTime(elapsedSeconds)}.`}
                    </p>
                  </div>
                  {isNewBest && (
                    <span className="record-badge">
                      <Trophy aria-hidden="true" size={15} />
                      New best
                    </span>
                  )}
                  <button className="win-action" type="button" onClick={() => void loadPuzzle()}>
                    <RefreshCcw aria-hidden="true" size={18} />
                    Next puzzle
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
          <button className="secondary-action" type="button" onClick={retry} disabled={!puzzle || isLoading}>
            <RotateCcw aria-hidden="true" size={18} />
            Retry
          </button>
          <button
            className="secondary-action"
            type="button"
            onClick={hint}
            disabled={!puzzle || isLoading || solved || isResponding}
          >
            <Lightbulb aria-hidden="true" size={18} />
            Hint
          </button>
          <button className="primary-action" type="button" onClick={() => void loadPuzzle()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={18} />
            New puzzle
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {solved ? `Checkmate found in ${formatTime(elapsedSeconds)}` : statusMessage}
        </p>
      </section>

      {showRules && (
        <>
          <button className="rules-backdrop" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)} />
          <aside className="rules-panel" aria-label="How to play MiniChess">
            <div className="rules-heading">
              <div>
                <span>How to play</span>
                <h2>MiniChess rules</h2>
              </div>
              <button className="icon-action" type="button" aria-label="Close game rules" onClick={() => setShowRules(false)}>
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="piece-lineup" aria-hidden="true">
              {["wk", "wq", "wr", "wb", "wn", "wp"].map((piece) => (
                <img key={piece} src={`/games/mini-chess/pieces/${piece}.svg`} alt="" />
              ))}
            </div>

            <ol className="rules-list">
              <li>
                <strong>Find the forced checkmate</strong>
                <span>The side shown below the board moves first. Pieces use their familiar chess moves.</span>
              </li>
              <li>
                <strong>Select, then move</strong>
                <span>Click a piece and its destination, or drag it to a highlighted legal square.</span>
              </li>
              <li>
                <strong>Continue the tactic</strong>
                <span>Your opponent replies automatically. Find each move until the king is checkmated.</span>
              </li>
              <li>
                <strong>Hints play one move</strong>
                <span>A hint makes the next move for you and makes the current run ineligible for a best time.</span>
              </li>
              <li>
                <strong>Gardner boards are 5 by 5</strong>
                <span>Pawns move one square at a time, and there is no castling.</span>
              </li>
            </ol>
          </aside>
        </>
      )}
    </main>
  );
}
