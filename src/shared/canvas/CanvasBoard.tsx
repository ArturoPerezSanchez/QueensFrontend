import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Application, Assets, Container, Graphics, type Texture } from "pixi.js";
import { addLabel, addRect, addSprite, cssVar } from "./drawing";

export const CANVAS_BOARD_SIZE = 1000;
export const CANVAS_BOARD_HUD_HEIGHT = 110;

export type CanvasBoardMetric = {
  label: string;
  value: string;
};

export type CanvasBoardHud = {
  metrics: readonly CanvasBoardMetric[];
  variant?: "suite" | "xp-classic";
  iconAsset?: string;
  digitAssets?: readonly string[];
  minusAsset?: string;
  action?: {
    label: string;
    onActivate: () => void;
  };
};

export type CanvasCellPosition = {
  row: number;
  col: number;
};

export type CanvasWheelDirection = -1 | 1;

export type CanvasBoardCell = CanvasCellPosition & {
  key: string;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
};

export type CanvasBoardPointer = CanvasCellPosition & {
  x: number;
  y: number;
  event: ReactPointerEvent<HTMLDivElement>;
};

export type CanvasBoardScene = {
  root: Container;
  textures: ReadonlyMap<string, Texture>;
  host: HTMLDivElement;
  size: number;
  cellWidth: number;
  cellHeight: number;
};

export type CanvasBoardAnimationFrame = {
  context: CanvasRenderingContext2D;
  host: HTMLDivElement;
  elapsedMilliseconds: number;
  size: number;
  cellWidth: number;
  cellHeight: number;
};

type CanvasBoardProps = {
  ariaLabel: string;
  rows: number;
  cols: number;
  cells: readonly CanvasBoardCell[];
  className?: string;
  assetUrls?: readonly string[];
  hud?: CanvasBoardHud;
  draw: (scene: CanvasBoardScene) => void;
  animate?: (frame: CanvasBoardAnimationFrame) => void;
  animationFps?: number;
  onCellActivate?: (position: CanvasCellPosition) => void;
  onCellContextMenu?: (position: CanvasCellPosition) => void;
  onCellWheel?: (position: CanvasCellPosition, direction: CanvasWheelDirection) => void;
  onPointerDown?: (pointer: CanvasBoardPointer) => void;
  onPointerMove?: (pointer: CanvasBoardPointer) => void;
  onPointerUp?: (pointer: CanvasBoardPointer) => void;
  onPointerCancel?: () => void;
  activateOnPointer?: boolean;
};

type WheelGesture = CanvasCellPosition & {
  accumulatedDelta: number;
  direction: CanvasWheelDirection;
  lastActivationAt: number;
  lastEventAt: number;
};

const WHEEL_GESTURE_RESET_MS = 180;
const WHEEL_ROTATION_COOLDOWN_MS = 70;
const WHEEL_ROTATION_THRESHOLD = 24;

function positionFromClient(
  target: HTMLDivElement,
  clientX: number,
  clientY: number,
  rows: number,
  cols: number,
  hudHeight: number,
): (CanvasCellPosition & { x: number; y: number }) | null {
  const bounds = target.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const normalizedX = (clientX - bounds.left) / bounds.width;
  const boardTop = bounds.top + (hudHeight / CANVAS_BOARD_SIZE) * bounds.width;
  const normalizedY = (clientY - boardTop) / bounds.width;
  if (normalizedX < 0 || normalizedY < 0 || normalizedX >= 1 || normalizedY >= 1) {
    return null;
  }

  return {
    row: Math.min(rows - 1, Math.floor(normalizedY * rows)),
    col: Math.min(cols - 1, Math.floor(normalizedX * cols)),
    x: normalizedX * CANVAS_BOARD_SIZE,
    y: normalizedY * CANVAS_BOARD_SIZE,
  };
}

function positionFromPointer(
  event: ReactPointerEvent<HTMLDivElement>,
  rows: number,
  cols: number,
  hudHeight: number,
): CanvasBoardPointer | null {
  const position = positionFromClient(
    event.currentTarget,
    event.clientX,
    event.clientY,
    rows,
    cols,
    hudHeight,
  );
  if (!position) {
    return null;
  }

  return {
    ...position,
    event,
  };
}

function drawBevel(
  root: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  light: string,
  dark: string,
  thickness: number,
): void {
  const bevel = new Graphics();
  bevel
    .moveTo(x + width, y)
    .lineTo(x, y)
    .lineTo(x, y + height)
    .stroke({ color: light, width: thickness, cap: "square" });
  bevel
    .moveTo(x, y + height)
    .lineTo(x + width, y + height)
    .lineTo(x + width, y)
    .stroke({ color: dark, width: thickness, cap: "square" });
  root.addChild(bevel);
}

function drawDigitalValue(
  root: Container,
  textures: ReadonlyMap<string, Texture>,
  value: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  hud: CanvasBoardHud,
): void {
  if (!hud.digitAssets || hud.digitAssets.length < 10) {
    addLabel(root, value, centerX, centerY, {
      color: "#ff1f1f",
      fontSize: 39,
      fontFamily: "Consolas, monospace",
      fontWeight: "700",
    });
    return;
  }

  const baseHeight = 43;
  const glyphs = [...value].map((character) => {
    const digit = Number(character);
    const asset = Number.isInteger(digit) && digit >= 0 && digit <= 9
      ? hud.digitAssets?.[digit]
      : character === "-"
        ? hud.minusAsset
        : undefined;
    return { asset, character, width: asset ? baseHeight * (13 / 23) : baseHeight * 0.44 };
  });
  const naturalWidth = glyphs.reduce((total, glyph) => total + glyph.width, 0);
  const scale = Math.min(1, maxWidth / Math.max(1, naturalWidth));
  const height = baseHeight * scale;
  let cursor = centerX - (naturalWidth * scale) / 2;

  glyphs.forEach((glyph) => {
    const width = glyph.width * scale;
    if (glyph.asset) {
      const sprite = addSprite(root, textures.get(glyph.asset), cursor + width / 2, centerY, width, height);
      if (sprite) {
        sprite.texture.source.scaleMode = "nearest";
      }
    } else {
      addLabel(root, glyph.character, cursor + width / 2, centerY - 1, {
        color: "#ff1f1f",
        fontSize: height * 0.78,
        fontFamily: "Consolas, monospace",
        fontWeight: "700",
      });
    }
    cursor += width;
  });
}

function drawSuiteHud(root: Container, host: HTMLElement, metrics: readonly CanvasBoardMetric[]): void {
  const background = cssVar(host, "--game-elevated", "#ffffff");
  const border = cssVar(host, "--game-grid", "#626a70");
  const text = cssVar(host, "--game-text", "#202124");
  const muted = cssVar(host, "--game-muted", "#686d73");
  const accent = cssVar(host, "--game-accent", "#3478bd");
  addRect(root, 0, 0, CANVAS_BOARD_SIZE, CANVAS_BOARD_HUD_HEIGHT, background);

  const columnWidth = CANVAS_BOARD_SIZE / Math.max(1, metrics.length);
  metrics.forEach((metric, index) => {
    const centerX = index * columnWidth + columnWidth / 2;
    addLabel(root, metric.label.toUpperCase(), centerX, 28, {
      color: muted,
      fontSize: 22,
      fontWeight: "700",
    });
    addLabel(root, metric.value, centerX, 72, {
      color: text,
      fontSize: 38,
      fontWeight: "800",
    });
  });

  const lines = new Graphics();
  for (let index = 1; index < metrics.length; index += 1) {
    lines.moveTo(index * columnWidth, 15).lineTo(index * columnWidth, CANVAS_BOARD_HUD_HEIGHT - 15);
  }
  lines.moveTo(0, CANVAS_BOARD_HUD_HEIGHT - 2).lineTo(CANVAS_BOARD_SIZE, CANVAS_BOARD_HUD_HEIGHT - 2);
  lines.stroke({ color: border, width: 2, alpha: 0.38 });
  root.addChild(lines);
  addRect(root, 0, CANVAS_BOARD_HUD_HEIGHT - 5, CANVAS_BOARD_SIZE, 5, accent);
}

function drawXpHud(
  root: Container,
  textures: ReadonlyMap<string, Texture>,
  hud: CanvasBoardHud,
): void {
  const background = "#c0c0c0";
  const light = "#ffffff";
  const dark = "#808080";
  addRect(root, 0, 0, CANVAS_BOARD_SIZE, CANVAS_BOARD_HUD_HEIGHT, background);
  drawBevel(root, 5, 5, CANVAS_BOARD_SIZE - 10, CANVAS_BOARD_HUD_HEIGHT - 10, light, dark, 5);

  const columnWidth = CANVAS_BOARD_SIZE / Math.max(1, hud.metrics.length);
  hud.metrics.forEach((metric, index) => {
    const x = index * columnWidth + 15;
    const width = columnWidth - 30;
    addLabel(root, metric.label.toUpperCase(), x + width / 2, 21, {
      color: "#111111",
      fontSize: 19,
      fontFamily: "Tahoma, Segoe UI, sans-serif",
      fontWeight: "700",
    });
    addRect(root, x, 36, width, 58, "#050505");
    drawBevel(root, x, 36, width, 58, dark, light, 3);

    const hasCenterIcon = index === 1 && Boolean(hud.iconAsset);
    const valueCenter = hasCenterIcon ? x + width * 0.68 : x + width / 2;
    drawDigitalValue(root, textures, metric.value, valueCenter, 65, hasCenterIcon ? width * 0.5 : width - 24, hud);
    if (hasCenterIcon && hud.iconAsset) {
      const icon = addSprite(root, textures.get(hud.iconAsset), x + width * 0.29, 65, 48, 48);
      if (icon) {
        icon.texture.source.scaleMode = "nearest";
      }
    }
  });
}

function drawHud(
  root: Container,
  textures: ReadonlyMap<string, Texture>,
  host: HTMLElement,
  hud: CanvasBoardHud,
): void {
  if (hud.variant === "xp-classic") {
    drawXpHud(root, textures, hud);
  } else {
    drawSuiteHud(root, host, hud.metrics);
  }
}

export function CanvasBoard({
  ariaLabel,
  rows,
  cols,
  cells,
  className = "",
  assetUrls = [],
  hud,
  draw,
  animate,
  animationFps = 30,
  onCellActivate,
  onCellContextMenu,
  onCellWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  activateOnPointer = true,
}: CanvasBoardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const animationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelGestureRef = useRef<WheelGesture | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [appearanceVersion, setAppearanceVersion] = useState(0);
  const hudHeight = hud ? CANVAS_BOARD_HUD_HEIGHT : 0;
  const surfaceHeight = CANVAS_BOARD_SIZE + hudHeight;
  const assetKey = assetUrls.join("|");
  const stableAssetUrls = useMemo(() => assetKey.split("|").filter(Boolean), [assetKey]);
  const hudAssetKey = [hud?.iconAsset, ...(hud?.digitAssets ?? []), hud?.minusAsset].filter(Boolean).join("|");
  const stableHudAssetUrls = useMemo(() => hudAssetKey.split("|").filter(Boolean), [hudAssetKey]);

  useEffect(() => {
    setSceneReady(false);
  }, [assetKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === "data-theme" || mutation.attributeName === "data-skin")) {
        setAppearanceVersion((version) => version + 1);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const shell = host.closest(".suite-shell");
    if (shell) {
      observer.observe(shell, { attributes: true, attributeFilter: ["data-skin"] });
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    let cancelled = false;
    const nextApplication = new Application();
    void nextApplication
      .init({
        width: CANVAS_BOARD_SIZE,
        height: surfaceHeight,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoStart: false,
        sharedTicker: false,
        preference: "canvas",
        powerPreference: "high-performance",
      })
      .then(() => {
        if (cancelled) {
          nextApplication.destroy(false, { children: true });
          return;
        }
        const canvas = nextApplication.canvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        surface.replaceChildren(canvas);
        setApplication(nextApplication);
      });

    return () => {
      cancelled = true;
      if (nextApplication.renderer) {
        const canvas = nextApplication.canvas;
        if (canvas.parentNode === surface) {
          surface.removeChild(canvas);
        }
        nextApplication.destroy(false, { children: true });
      }
    };
  }, [surfaceHeight]);

  useEffect(() => {
    const host = hostRef.current;
    if (!application || !host) {
      return;
    }

    let cancelled = false;
    let settleFrame: number | null = null;
    const sceneRoot = new Container({ y: hudHeight });

    const renderScene = (loadedAssets: ReadonlyArray<readonly [string, Texture]>) => {
      if (cancelled) {
        sceneRoot.destroy({ children: true });
        return;
      }

      application.stage.addChild(sceneRoot);
      draw({
        root: sceneRoot,
        textures: new Map(loadedAssets),
        host,
        size: CANVAS_BOARD_SIZE,
        cellWidth: CANVAS_BOARD_SIZE / cols,
        cellHeight: CANVAS_BOARD_SIZE / rows,
      });
      application.render();
      settleFrame = window.requestAnimationFrame(() => {
        if (!cancelled) {
          application.render();
          setSceneReady(true);
        }
      });
    };

    void Promise.all(
      stableAssetUrls.map(async (url) => [url, await Assets.load<Texture>(url)] as const),
    )
      .then(renderScene)
      .catch((error: unknown) => {
        console.error("Canvas board asset loading failed", error);
        renderScene([]);
      });

    return () => {
      cancelled = true;
      if (settleFrame !== null) {
        window.cancelAnimationFrame(settleFrame);
      }
      if (sceneRoot.parent) {
        sceneRoot.parent.removeChild(sceneRoot);
      }
      if (!sceneRoot.destroyed) {
        sceneRoot.destroy({ children: true });
      }
    };
  }, [application, appearanceVersion, cols, draw, hudHeight, rows, stableAssetUrls]);

  useEffect(() => {
    const host = hostRef.current;
    if (!application || !host || !hud) {
      return;
    }

    let cancelled = false;
    const hudRoot = new Container();
    const renderHud = (loadedAssets: ReadonlyArray<readonly [string, Texture]>) => {
      if (cancelled) {
        hudRoot.destroy({ children: true });
        return;
      }
      application.stage.addChild(hudRoot);
      drawHud(hudRoot, new Map(loadedAssets), host, hud);
      application.render();
    };

    void Promise.all(
      stableHudAssetUrls.map(async (url) => [url, await Assets.load<Texture>(url)] as const),
    )
      .then(renderHud)
      .catch((error: unknown) => {
        console.error("Canvas HUD asset loading failed", error);
        renderHud([]);
      });

    return () => {
      cancelled = true;
      if (hudRoot.parent) {
        hudRoot.parent.removeChild(hudRoot);
      }
      if (!hudRoot.destroyed) {
        hudRoot.destroy({ children: true });
      }
    };
  }, [application, appearanceVersion, hud, stableHudAssetUrls]);

  useEffect(() => {
    const canvas = animationCanvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_BOARD_SIZE * resolution;
    canvas.height = surfaceHeight * resolution;
    context.setTransform(resolution, 0, 0, resolution, 0, 0);
    context.clearRect(0, 0, CANVAS_BOARD_SIZE, surfaceHeight);

    if (!animate || !sceneReady) {
      return;
    }

    const frameDuration = 1000 / Math.max(1, animationFps);
    const startedAt = window.performance.now();
    let previousFrame = -frameDuration;
    let frameId: number | null = null;

    const paint = (elapsedMilliseconds: number) => {
      context.clearRect(0, 0, CANVAS_BOARD_SIZE, surfaceHeight);
      context.save();
      context.translate(0, hudHeight);
      animate({
        context,
        host,
        elapsedMilliseconds,
        size: CANVAS_BOARD_SIZE,
        cellWidth: CANVAS_BOARD_SIZE / cols,
        cellHeight: CANVAS_BOARD_SIZE / rows,
      });
      context.restore();
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(0);
      return;
    }

    paint(0);
    const tick = (timestamp: number) => {
      const elapsed = timestamp - startedAt;
      if (elapsed - previousFrame >= frameDuration) {
        paint(elapsed);
        previousFrame = elapsed;
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      context.clearRect(0, 0, CANVAS_BOARD_SIZE, surfaceHeight);
    };
  }, [animate, animationFps, cols, hudHeight, rows, sceneReady, surfaceHeight]);

  const activateFromPointer = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!activateOnPointer || !onCellActivate || event.detail === 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * cols);
    const boardTop = bounds.top + (hudHeight / CANVAS_BOARD_SIZE) * bounds.width;
    const row = Math.floor(((event.clientY - boardTop) / bounds.width) * rows);
    if (row >= 0 && col >= 0 && row < rows && col < cols) {
      onCellActivate({ row, col });
    }
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!onCellContextMenu) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * cols);
    const boardTop = bounds.top + (hudHeight / CANVAS_BOARD_SIZE) * bounds.width;
    const row = Math.floor(((event.clientY - boardTop) / bounds.width) * rows);
    if (row >= 0 && col >= 0 && row < rows && col < cols) {
      onCellContextMenu({ row, col });
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!onCellWheel || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    const position = positionFromClient(
      event.currentTarget,
      event.clientX,
      event.clientY,
      rows,
      cols,
      hudHeight,
    );
    const rawDelta = event.deltaY;
    if (!position || rawDelta === 0) {
      return;
    }

    event.preventDefault();
    const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? CANVAS_BOARD_SIZE : 1;
    const direction: CanvasWheelDirection = rawDelta > 0 ? 1 : -1;
    const now = performance.now();
    const previous = wheelGestureRef.current;
    const continuesGesture =
      previous !== null &&
      previous.row === position.row &&
      previous.col === position.col &&
      previous.direction === direction &&
      now - previous.lastEventAt <= WHEEL_GESTURE_RESET_MS;
    const gesture: WheelGesture = continuesGesture
      ? {
          ...previous,
          accumulatedDelta: previous.accumulatedDelta + Math.abs(rawDelta) * deltaScale,
          lastEventAt: now,
        }
      : {
          ...position,
          accumulatedDelta: Math.abs(rawDelta) * deltaScale,
          direction,
          lastActivationAt: Number.NEGATIVE_INFINITY,
          lastEventAt: now,
        };

    if (
      gesture.accumulatedDelta >= WHEEL_ROTATION_THRESHOLD &&
      now - gesture.lastActivationAt >= WHEEL_ROTATION_COOLDOWN_MS
    ) {
      onCellWheel(position, direction);
      gesture.accumulatedDelta = 0;
      gesture.lastActivationAt = now;
    }
    wheelGestureRef.current = gesture;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = positionFromPointer(event, rows, cols, hudHeight);
    if (!pointer) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    onPointerDown?.(pointer);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = positionFromPointer(event, rows, cols, hudHeight);
    if (pointer) {
      onPointerMove?.(pointer);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = positionFromPointer(event, rows, cols, hudHeight);
    if (pointer) {
      onPointerUp?.(pointer);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={`canvas-board ${className} ${sceneReady ? "is-ready" : "is-loading"}`.trim()}
      ref={hostRef}
      style={
        {
          "--canvas-board-aspect": `${CANVAS_BOARD_SIZE} / ${surfaceHeight}`,
          "--canvas-board-hud-ratio": `${(hudHeight / surfaceHeight) * 100}%`,
          "--canvas-board-grid-ratio": `${(CANVAS_BOARD_SIZE / surfaceHeight) * 100}%`,
        } as CSSProperties
      }
      role="group"
      aria-label={ariaLabel}
      aria-busy={!sceneReady}
      onClick={activateFromPointer}
      onContextMenu={handleContextMenu}
      onPointerCancel={onPointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div className="canvas-board-renderer" ref={surfaceRef} aria-hidden="true" />
      <canvas className="canvas-board-animation" ref={animationCanvasRef} aria-hidden="true" />
      {hud?.action && (
        <button
          className="canvas-board-hud-action"
          type="button"
          aria-label={hud.action.label}
          style={{
            top: `${((hudHeight / 2) / surfaceHeight) * 100}%`,
            width: `${(54 / CANVAS_BOARD_SIZE) * 100}%`,
          }}
          onClick={(event) => {
            event.stopPropagation();
            hud.action?.onActivate();
          }}
        />
      )}
      <div
        className="canvas-board-accessibility"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            aria-label={cell.label}
            aria-pressed={cell.pressed}
            disabled={cell.disabled}
            onClick={(event) => {
              event.stopPropagation();
              onCellActivate?.(cell);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCellContextMenu?.(cell);
            }}
          />
        ))}
      </div>
    </div>
  );
}
