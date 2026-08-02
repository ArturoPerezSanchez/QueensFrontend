import { useContext } from "react";
import type { GameId } from "@/shared/gameOptions";
import { SkinContext, type SkinContextValue } from "./SkinContext";
import { findGameSkin, type GameSkinDefinition } from "./skins";

export function useSkins(): SkinContextValue {
  const value = useContext(SkinContext);
  if (!value) {
    throw new Error("useSkins must be used inside SkinProvider.");
  }
  return value;
}

export function useGameSkin<G extends GameId>(gameId: G): GameSkinDefinition<G> {
  const { selectedSkins } = useSkins();
  const skin = findGameSkin(gameId, selectedSkins[gameId]);

  if (!skin) {
    throw new Error(`No skin definition found for ${gameId}.`);
  }

  return skin;
}
