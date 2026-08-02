import {
  Bomb,
  Crown,
  Lightbulb,
  Route,
  Spline,
  SunMoon,
  type LucideIcon,
} from "lucide-react";
import { ChessKnightIcon } from "./ChessKnightIcon";
import type { GameId } from "@/shared/gameOptions";

export const GAME_ICONS: Record<GameId, LucideIcon> = {
  queens: Crown,
  tango: SunMoon,
  lights: Lightbulb,
  tracks: Spline,
  zip: Route,
  "mine-islands": Bomb,
  "mini-chess": ChessKnightIcon,
};
