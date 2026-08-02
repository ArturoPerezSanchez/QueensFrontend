import { Graphics, Sprite, Text, type Container, type Texture } from "pixi.js";

export type CssColor = string | number;

export function cssVar(host: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(host).getPropertyValue(name).trim() || fallback;
}

export function addRect(
  root: Container,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: CssColor,
  stroke?: { color: CssColor; width: number; alpha?: number },
  radius = 0,
): Graphics {
  const graphic = new Graphics();
  if (radius > 0) {
    graphic.roundRect(x, y, width, height, radius);
  } else {
    graphic.rect(x, y, width, height);
  }
  graphic.fill(fill);
  if (stroke) {
    graphic.stroke({ color: stroke.color, width: stroke.width, alpha: stroke.alpha ?? 1 });
  }
  root.addChild(graphic);
  return graphic;
}

export function addCircle(
  root: Container,
  x: number,
  y: number,
  radius: number,
  fill: CssColor,
  stroke?: { color: CssColor; width: number; alpha?: number },
): Graphics {
  const graphic = new Graphics().circle(x, y, radius).fill(fill);
  if (stroke) {
    graphic.stroke({ color: stroke.color, width: stroke.width, alpha: stroke.alpha ?? 1 });
  }
  root.addChild(graphic);
  return graphic;
}

export function addLine(
  root: Container,
  points: readonly number[],
  color: CssColor,
  width: number,
  alpha = 1,
): Graphics {
  const graphic = new Graphics();
  graphic.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    graphic.lineTo(points[index], points[index + 1]);
  }
  graphic.stroke({ color, width, alpha, cap: "round", join: "round" });
  root.addChild(graphic);
  return graphic;
}

export function addLabel(
  root: Container,
  value: string,
  x: number,
  y: number,
  options: {
    color: CssColor;
    fontSize: number;
    fontWeight?: "normal" | "bold" | "400" | "500" | "600" | "700" | "800" | "900";
    fontFamily?: string;
    anchor?: number;
  },
): Text {
  const label = new Text({
    text: value,
    style: {
      fill: options.color,
      fontFamily: options.fontFamily ?? "Inter, Segoe UI, sans-serif",
      fontSize: options.fontSize,
      fontWeight: options.fontWeight ?? "700",
      align: "center",
    },
    anchor: options.anchor ?? 0.5,
    x,
    y,
    resolution: 2,
  });
  root.addChild(label);
  return label;
}

export function addSprite(
  root: Container,
  texture: Texture | undefined,
  x: number,
  y: number,
  width: number,
  height = width,
  options: { alpha?: number; rotation?: number; tint?: CssColor } = {},
): Sprite | null {
  if (!texture) {
    return null;
  }

  const sprite = new Sprite({ texture, anchor: 0.5, x, y });
  sprite.width = width;
  sprite.height = height;
  sprite.alpha = options.alpha ?? 1;
  sprite.rotation = options.rotation ?? 0;
  if (options.tint !== undefined) {
    sprite.tint = options.tint;
  }
  root.addChild(sprite);
  return sprite;
}
