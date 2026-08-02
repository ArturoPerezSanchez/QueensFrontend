import { createContext } from "react";
import type { GameId } from "@/shared/gameOptions";
import type { GameSkinSelections } from "./skins";

export type SkinContextValue = {
  selectedSkins: GameSkinSelections;
  selectSkin: (gameId: GameId, skinId: string) => void;
  isSkinUnlocked: (gameId: GameId, skinId: string) => boolean;
};

export const SkinContext = createContext<SkinContextValue | null>(null);
