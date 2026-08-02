import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GameId } from "@/shared/gameOptions";
import { SkinContext } from "./SkinContext";
import {
  DEFAULT_GAME_SKINS,
  findGameSkin,
  isGameSkinUnlocked,
  type GameSkinSelections,
} from "./skins";

const STORAGE_KEY = "mindlab-game-skins-v1";
const NO_ACHIEVEMENTS: readonly string[] = [];

function parseStoredSelections(value: string | null): GameSkinSelections {
  try {
    const stored = JSON.parse(value ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(DEFAULT_GAME_SKINS).map(([gameId, fallback]) => {
        const requested = stored[gameId];
        const valid = typeof requested === "string" && findGameSkin(gameId as GameId, requested);
        return [gameId, valid ? requested : fallback];
      }),
    ) as GameSkinSelections;
  } catch {
    return { ...DEFAULT_GAME_SKINS };
  }
}

function readStoredSelections(): GameSkinSelections {
  return parseStoredSelections(window.localStorage.getItem(STORAGE_KEY));
}

function writeStoredSelections(selections: GameSkinSelections): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}

export function SkinProvider({
  children,
  unlockedAchievementIds = NO_ACHIEVEMENTS,
}: {
  children: ReactNode;
  unlockedAchievementIds?: readonly string[];
}) {
  const unlockedAchievements = useMemo(
    () => new Set(unlockedAchievementIds),
    [unlockedAchievementIds],
  );
  const [storedSelections, setStoredSelections] = useState(readStoredSelections);

  const isSkinUnlocked = useCallback(
    (gameId: GameId, skinId: string) => {
      const skin = findGameSkin(gameId, skinId);
      return Boolean(skin && isGameSkinUnlocked(skin, unlockedAchievements));
    },
    [unlockedAchievements],
  );

  const selectedSkins = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(storedSelections).map(([gameId, skinId]) => {
          const typedGameId = gameId as GameId;
          return [
            gameId,
            isSkinUnlocked(typedGameId, skinId)
              ? skinId
              : DEFAULT_GAME_SKINS[typedGameId],
          ];
        }),
      ) as GameSkinSelections,
    [isSkinUnlocked, storedSelections],
  );

  useEffect(() => {
    const refreshFromStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setStoredSelections(parseStoredSelections(event.newValue));
      }
    };
    window.addEventListener("storage", refreshFromStorage);
    return () => window.removeEventListener("storage", refreshFromStorage);
  }, []);

  const selectSkin = useCallback(
    (gameId: GameId, skinId: string) => {
      if (!isSkinUnlocked(gameId, skinId) || storedSelections[gameId] === skinId) {
        return;
      }
      const nextSelections = { ...storedSelections, [gameId]: skinId };
      setStoredSelections(nextSelections);
      writeStoredSelections(nextSelections);
    },
    [isSkinUnlocked, storedSelections],
  );

  const value = useMemo(
    () => ({ selectedSkins, selectSkin, isSkinUnlocked }),
    [isSkinUnlocked, selectSkin, selectedSkins],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}
