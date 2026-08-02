export const GAME_OPTIONS = [
  { id: "queens", label: "Queens", difficulties: ["4x4", "5x5", "6x6", "7x7", "8x8", "9x9", "10x10"] },
  { id: "tango", label: "Tango", difficulties: ["4x4", "6x6", "8x8", "10x10"] },
  { id: "lights", label: "Lights", difficulties: ["4x4", "5x5", "6x6", "7x7", "8x8"] },
  { id: "tracks", label: "Tracks", difficulties: ["5x5", "6x6", "7x7", "8x8", "9x9"] },
  { id: "zip", label: "Zip", difficulties: ["4x4", "5x5", "6x6", "7x7", "8x8", "9x9", "10x10"] },
  { id: "mine-islands", label: "Mine Islands", difficulties: ["6x6", "7x7", "8x8", "9x9", "10x10"] },
  { id: "mini-chess", label: "MiniChess", difficulties: ["5x5", "8x8"] },
] as const;

export type GameId = (typeof GAME_OPTIONS)[number]["id"];

export const GAME_LABELS: Record<string, string> = Object.fromEntries(
  GAME_OPTIONS.map((game) => [game.id, game.label]),
);
