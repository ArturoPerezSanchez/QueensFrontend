import type { GameId } from "@/shared/gameOptions";

export type SkinUnlock =
  | { type: "starter" }
  | { type: "achievement"; achievementId: string };

export type SkinPreview = {
  sources: readonly [string, ...string[]];
  presentation: "contain" | "pair" | "cover";
};

export type SkinSymbolAsset = {
  src: string;
  label: string;
};

/**
 * Asset roles are game-specific on purpose. Adding a skin should be a data and
 * asset change; renderers consume stable roles instead of knowing skin IDs.
 */
export type GameSkinAssetMap = {
  queens: {
    marker: string;
  };
  tango: {
    symbols: readonly [SkinSymbolAsset, SkinSymbolAsset];
  };
  lights: {
    bulbs: readonly [string, string];
  };
  tracks: {
    node: string;
    flowParticle?: {
      src: string;
      size: number;
      spacing: number;
      speed: number;
      opacity?: number;
      drift?: number;
      flicker?: number;
      rotateToPath?: boolean;
      additive?: boolean;
      pulseOpacity?: number;
    };
  };
  zip: {
    revealImage?: string;
  };
  "mine-islands": {
    hazard: string;
    flag: string;
    death?: string;
    misflagged?: string;
    clueTiles?: readonly string[];
    hud?: {
      variant: "xp-classic";
      faces: {
        neutral: string;
        won: string;
        lost: string;
        pressed: string;
      };
      digits: readonly string[];
      minus: string;
    };
  };
  "mini-chess": {
    pieceSetRoot: string;
    pieceExtension: "svg" | "png" | "webp";
  };
};

export type GameSkinDefinition<G extends GameId = GameId> = {
  id: string;
  name: string;
  description: string;
  preview: SkinPreview;
  assets: GameSkinAssetMap[G];
  unlock: SkinUnlock;
};

type GameSkinCatalog = {
  [G in GameId]: readonly GameSkinDefinition<G>[];
};

export const GAME_SKINS = {
  queens: [
    {
      id: "studio",
      name: "Royal",
      description: "The original crown marker set.",
      preview: {
        sources: ["/games/queens/queen.png"],
        presentation: "contain",
      },
      assets: {
        marker: "/games/queens/queen.png",
      },
      unlock: { type: "starter" },
    },
    {
      id: "garden",
      name: "Rose garden",
      description: "Place open-source rose sprites instead of queens.",
      preview: {
        sources: ["/games/queens/skins/garden/rose.svg"],
        presentation: "contain",
      },
      assets: {
        marker: "/games/queens/skins/garden/rose.svg",
      },
      unlock: { type: "starter" },
    },
  ],
  tango: [
    {
      id: "classic",
      name: "Classic",
      description: "The original Lucide sun and moon pair.",
      preview: {
        sources: [
          "/games/tango/skins/classic/sun.svg",
          "/games/tango/skins/classic/moon.svg",
        ],
        presentation: "pair",
      },
      assets: {
        symbols: [
          { src: "/games/tango/skins/classic/moon.svg", label: "Moon" },
          { src: "/games/tango/skins/classic/sun.svg", label: "Sun" },
        ],
      },
      unlock: { type: "starter" },
    },
    {
      id: "emoji",
      name: "Emoji orbit",
      description: "The detailed Noto Emoji sun and moon pair.",
      preview: {
        sources: [
          "/games/tango/skins/emoji/sun-face.svg",
          "/games/tango/skins/emoji/crescent-moon.svg",
        ],
        presentation: "pair",
      },
      assets: {
        symbols: [
          { src: "/games/tango/skins/emoji/crescent-moon.svg", label: "Moon" },
          { src: "/games/tango/skins/emoji/sun-face.svg", label: "Sun" },
        ],
      },
      unlock: { type: "starter" },
    },
    {
      id: "elements",
      name: "Elements",
      description: "Balance water and fire with a complete symbol swap.",
      preview: {
        sources: [
          "/games/tango/skins/elements/water.svg",
          "/games/tango/skins/elements/fire.svg",
        ],
        presentation: "pair",
      },
      assets: {
        symbols: [
          { src: "/games/tango/skins/elements/water.svg", label: "Water" },
          { src: "/games/tango/skins/elements/fire.svg", label: "Fire" },
        ],
      },
      unlock: { type: "starter" },
    },
  ],
  lights: [
    {
      id: "warm-glow",
      name: "Warm glow",
      description: "The original light board.",
      preview: {
        sources: ["/games/lights/logo.png"],
        presentation: "contain",
      },
      assets: {
        bulbs: [
          "/games/lights/skins/warm-glow/unlit.png",
          "/games/lights/skins/warm-glow/lit.png",
        ],
      },
      unlock: { type: "starter" },
    },
  ],
  tracks: [
    {
      id: "transit",
      name: "Transit",
      description: "The original technical track set.",
      preview: {
        sources: ["/games/tracks/logo.png"],
        presentation: "contain",
      },
      assets: {
        node: "/games/tracks/skins/transit/node.png",
      },
      unlock: { type: "starter" },
    },
    {
      id: "liquid",
      name: "Liquid",
      description: "Coolant and bubbles flow continuously through the pipe network.",
      preview: {
        sources: [
          "/games/tracks/skins/liquid/node.png",
          "/games/tracks/skins/liquid/particle.png",
        ],
        presentation: "pair",
      },
      assets: {
        node: "/games/tracks/skins/liquid/node.png",
        flowParticle: {
          src: "/games/tracks/skins/liquid/particle.png",
          size: 0.12,
          spacing: 0.38,
          speed: 0.55,
          opacity: 0.72,
          drift: 0.018,
          flicker: 0.08,
          pulseOpacity: 0.28,
        },
      },
      unlock: { type: "starter" },
    },
    {
      id: "electric",
      name: "Electric",
      description: "Live electrical discharges race through every connected pipe.",
      preview: {
        sources: [
          "/games/tracks/skins/electric/node.png",
          "/games/tracks/skins/electric/particle.png",
        ],
        presentation: "pair",
      },
      assets: {
        node: "/games/tracks/skins/electric/node.png",
        flowParticle: {
          src: "/games/tracks/skins/electric/particle.png",
          size: 0.25,
          spacing: 0.72,
          speed: 1.05,
          opacity: 0.94,
          drift: 0.012,
          flicker: 0.55,
          rotateToPath: true,
          additive: true,
          pulseOpacity: 0.92,
        },
      },
      unlock: { type: "starter" },
    },
  ],
  zip: [
    {
      id: "current",
      name: "Current",
      description: "The original flowing route treatment.",
      preview: {
        sources: ["/games/zip/logo.png"],
        presentation: "contain",
      },
      assets: {},
      unlock: { type: "starter" },
    },
    {
      id: "spain",
      name: "Spanish Flag",
      description: "A flat Spanish flag is revealed inside every route segment.",
      preview: {
        sources: ["/games/zip/skins/spain/flag.svg"],
        presentation: "contain",
      },
      assets: {
        revealImage: "/games/zip/skins/spain/flag.svg",
      },
      unlock: { type: "starter" },
    },
  ],
  "mine-islands": [
    {
      id: "survey",
      name: "Survey",
      description: "The original minefield set.",
      preview: {
        sources: ["/games/mine-islands/logo.svg"],
        presentation: "contain",
      },
      assets: {
        hazard: "/games/mine-islands/skins/survey/bomb.svg",
        flag: "/games/mine-islands/skins/survey/flag.svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "xp-classic",
      name: "XP Classic",
      description: "Classic desktop Minesweeper tiles, counters, and status faces.",
      preview: {
        sources: [
          "/games/mine-islands/skins/xp-classic/mine-ceil.png",
          "/games/mine-islands/skins/xp-classic/smile.png",
        ],
        presentation: "pair",
      },
      assets: {
        hazard: "/games/mine-islands/skins/xp-classic/mine-ceil.png",
        flag: "/games/mine-islands/skins/xp-classic/flag.png",
        death: "/games/mine-islands/skins/xp-classic/mine-death.png",
        misflagged: "/games/mine-islands/skins/xp-classic/misflagged.png",
        clueTiles: [
          "/games/mine-islands/skins/xp-classic/open1.png",
          "/games/mine-islands/skins/xp-classic/open2.png",
          "/games/mine-islands/skins/xp-classic/open3.png",
          "/games/mine-islands/skins/xp-classic/open4.png",
          "/games/mine-islands/skins/xp-classic/open5.png",
          "/games/mine-islands/skins/xp-classic/open6.png",
          "/games/mine-islands/skins/xp-classic/open7.png",
          "/games/mine-islands/skins/xp-classic/open8.png",
        ],
        hud: {
          variant: "xp-classic",
          faces: {
            neutral: "/games/mine-islands/skins/xp-classic/smile.png",
            won: "/games/mine-islands/skins/xp-classic/win.png",
            lost: "/games/mine-islands/skins/xp-classic/dead.png",
            pressed: "/games/mine-islands/skins/xp-classic/ohh.png",
          },
          digits: [
            "/games/mine-islands/skins/xp-classic/digit0.png",
            "/games/mine-islands/skins/xp-classic/digit1.png",
            "/games/mine-islands/skins/xp-classic/digit2.png",
            "/games/mine-islands/skins/xp-classic/digit3.png",
            "/games/mine-islands/skins/xp-classic/digit4.png",
            "/games/mine-islands/skins/xp-classic/digit5.png",
            "/games/mine-islands/skins/xp-classic/digit6.png",
            "/games/mine-islands/skins/xp-classic/digit7.png",
            "/games/mine-islands/skins/xp-classic/digit8.png",
            "/games/mine-islands/skins/xp-classic/digit9.png",
          ],
          minus: "/games/mine-islands/skins/xp-classic/digit-.png",
        },
      },
      unlock: { type: "starter" },
    },
  ],
  "mini-chess": [
    {
      id: "club",
      name: "Club",
      description: "The original tournament piece set.",
      preview: {
        sources: [
          "/games/mini-chess/skins/club/wn.svg",
          "/games/mini-chess/skins/club/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/club",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "celtic",
      name: "Celtic",
      description: "Ornate dimensional pieces with a polished finish.",
      preview: {
        sources: [
          "/games/mini-chess/skins/celtic/wn.svg",
          "/games/mini-chess/skins/celtic/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/celtic",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "chessnut",
      name: "Chessnut",
      description: "A clean contemporary set with rounded silhouettes.",
      preview: {
        sources: [
          "/games/mini-chess/skins/chessnut/wn.svg",
          "/games/mini-chess/skins/chessnut/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/chessnut",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "fantasy",
      name: "Fantasy",
      description: "Expressive medieval pieces with dramatic profiles.",
      preview: {
        sources: [
          "/games/mini-chess/skins/fantasy/wn.svg",
          "/games/mini-chess/skins/fantasy/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/fantasy",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "firi",
      name: "Firi",
      description: "Bold compact pieces designed for instant recognition.",
      preview: {
        sources: [
          "/games/mini-chess/skins/firi/wn.svg",
          "/games/mini-chess/skins/firi/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/firi",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "kiwen-suwi",
      name: "Kiwen Suwi",
      description: "Minimal geometric pieces with strong graphic contrast.",
      preview: {
        sources: [
          "/games/mini-chess/skins/kiwen-suwi/wn.svg",
          "/games/mini-chess/skins/kiwen-suwi/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/kiwen-suwi",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "rhosgfx",
      name: "RhosGFX",
      description: "Friendly outlined pieces with a playful modern shape.",
      preview: {
        sources: [
          "/games/mini-chess/skins/rhosgfx/wn.svg",
          "/games/mini-chess/skins/rhosgfx/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/rhosgfx",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
    {
      id: "spatial",
      name: "Spatial",
      description: "Sculptural asymmetric pieces with a distinctive stance.",
      preview: {
        sources: [
          "/games/mini-chess/skins/spatial/wn.svg",
          "/games/mini-chess/skins/spatial/bn.svg",
        ],
        presentation: "pair",
      },
      assets: {
        pieceSetRoot: "/games/mini-chess/skins/spatial",
        pieceExtension: "svg",
      },
      unlock: { type: "starter" },
    },
  ],
} as const satisfies GameSkinCatalog;

const gameSkinCatalog: GameSkinCatalog = GAME_SKINS;

export type GameSkinSelections = Record<GameId, string>;

export const DEFAULT_GAME_SKINS = Object.fromEntries(
  (Object.keys(gameSkinCatalog) as GameId[]).map((gameId) => [
    gameId,
    gameSkinCatalog[gameId][0].id,
  ]),
) as GameSkinSelections;

export function findGameSkin<G extends GameId>(
  gameId: G,
  skinId: string,
): GameSkinDefinition<G> | undefined {
  return gameSkinCatalog[gameId].find((skin) => skin.id === skinId);
}

export function isGameSkinUnlocked(
  skin: Pick<GameSkinDefinition, "unlock">,
  unlockedAchievementIds: ReadonlySet<string>,
): boolean {
  return skin.unlock.type === "starter" || unlockedAchievementIds.has(skin.unlock.achievementId);
}
