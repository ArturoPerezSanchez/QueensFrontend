import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Check, Lock, Moon, Palette, Settings, Sun, Trophy, UserRound } from "lucide-react";
import { AccountView } from "@/features/account/AccountView";
import { LeaderboardView } from "@/features/leaderboard/LeaderboardView";
import { PlayerProfileView } from "@/features/profiles/PlayerProfileView";
import { useQueensPatternsSetting } from "@/features/settings/useConfig";
import { useTheme } from "@/features/settings/useTheme";
import { GAME_SKINS } from "@/features/skins/skins";
import { useSkins } from "@/features/skins/useSkins";
import { GAME_ICONS } from "@/shared/icons/gameIcons";
import "@/games/lights/styles.css";
import "@/games/mine-islands/styles.css";
import "@/games/mini-chess/styles.css";
import "@/games/queens/styles.css";
import "@/games/tango/styles.css";
import "@/games/tracks/styles.css";
import "@/games/zip/styles.css";
import "@/styles/game-frame.css";
import "@/styles/game-skins.css";
import "@/styles/canvas-board.css";

const APP_NAME = "MindLab";
const APP_FAVICON = "/brand/mindlab-favicon.png";

const QueensGame = lazy(() =>
  import("@/games/queens/QueensGame").then((module) => ({ default: module.QueensGame })),
);
const TangoGame = lazy(() =>
  import("@/games/tango/TangoGame").then((module) => ({ default: module.TangoGame })),
);
const LightsGame = lazy(() =>
  import("@/games/lights/LightsGame").then((module) => ({ default: module.LightsGame })),
);
const TracksGame = lazy(() =>
  import("@/games/tracks/TracksGame").then((module) => ({ default: module.TracksGame })),
);
const ZipGame = lazy(() =>
  import("@/games/zip/ZipGame").then((module) => ({ default: module.ZipGame })),
);
const MineIslandsGame = lazy(() =>
  import("@/games/mine-islands/MineIslandsGame").then((module) => ({
    default: module.MineIslandsGame,
  })),
);
const MiniChessGame = lazy(() =>
  import("@/games/mini-chess/MiniChessGame").then((module) => ({
    default: module.MiniChessGame,
  })),
);

const GAMES = {
  queens: {
    label: "Queens",
    path: "/queens",
    favicon: "/games/queens/favicon.png",
    logo: "/games/queens/logo.png",
    description: "Place one queen per row, column, and region without touching.",
    meta: "4 x 4 to 10 x 10",
    icon: GAME_ICONS.queens,
    component: QueensGame,
  },
  tango: {
    label: "Tango",
    path: "/tango",
    favicon: "/games/tango/favicon.png",
    logo: "/games/tango/logo.png",
    description: "Balance suns and moons while obeying equality clues.",
    meta: "Even boards",
    icon: GAME_ICONS.tango,
    component: TangoGame,
  },
  lights: {
    label: "Lights",
    path: "/lights",
    favicon: "/games/lights/favicon.png",
    logo: "/games/lights/logo.png",
    description: "Flip tiles until every light on the board is glowing.",
    meta: "4 x 4 to 8 x 8",
    icon: GAME_ICONS.lights,
    component: LightsGame,
  },
  tracks: {
    label: "Tracks",
    path: "/tracks",
    favicon: "/games/tracks/favicon.png",
    logo: "/games/tracks/logo.png",
    description: "Rotate pieces into one continuous route between endpoints.",
    meta: "Diagonal tracks",
    icon: GAME_ICONS.tracks,
    component: TracksGame,
  },
  zip: {
    label: "Zip",
    path: "/zip",
    favicon: "/games/zip/favicon.png",
    logo: "/games/zip/logo.png",
    description: "Draw one path through every square in numbered order.",
    meta: "Path puzzle",
    icon: GAME_ICONS.zip,
    component: ZipGame,
  },
  "mine-islands": {
    label: "Mine Islands",
    path: "/mine-islands",
    favicon: "/games/mine-islands/favicon.svg",
    logo: "/games/mine-islands/logo.svg",
    description: "Reveal clear cells and mark hidden hazards using number clues.",
    meta: "6 x 6 to 10 x 10",
    icon: GAME_ICONS["mine-islands"],
    component: MineIslandsGame,
  },
  "mini-chess": {
    label: "MiniChess",
    path: "/mini-chess",
    favicon: "/games/mini-chess/skins/club/bn.svg",
    logo: "/games/mini-chess/skins/club/bn.svg",
    description: "Find a short forced checkmate from a focused position.",
    meta: "5 x 5 or 8 x 8",
    icon: GAME_ICONS["mini-chess"],
    component: MiniChessGame,
  },
} as const;

type GameId = keyof typeof GAMES;
type RouteState = GameId | "menu" | "config" | "account" | "leaderboard" | "player";

function pathFromLocation(): string {
  const hashPath = window.location.hash.replace(/^#/, "").replace(/^\/+/, "");
  return hashPath || window.location.pathname.replace(/^\/+/, "");
}

function playerIdFromLocation(): number | null {
  const [firstSegment, idSegment] = pathFromLocation().split("?")[0].split("/");
  if (firstSegment.toLowerCase() !== "players") {
    return null;
  }
  const playerId = Number(idSegment);
  return Number.isSafeInteger(playerId) && playerId > 0 ? playerId : null;
}

function routeFromLocation(): RouteState {
  const path = pathFromLocation();
  const firstSegment = path.split("/")[0].split("?")[0].toLowerCase();
  if (firstSegment === "config") {
    return "config";
  }
  if (firstSegment === "account") {
    return "account";
  }
  if (firstSegment === "leaderboard") {
    return "leaderboard";
  }
  if (firstSegment === "players" && playerIdFromLocation() !== null) {
    return "player";
  }
  return firstSegment in GAMES ? (firstSegment as GameId) : "menu";
}

function setFavicon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => routeFromLocation());
  const [playerId, setPlayerId] = useState<number | null>(() => playerIdFromLocation());
  const { theme, toggleTheme } = useTheme();
  const { selectedSkins } = useSkins();
  const activeGame = route in GAMES ? (route as GameId) : null;
  const game = activeGame ? GAMES[activeGame] : null;
  const GameComponent = game?.component;
  const activeSkin = activeGame ? selectedSkins[activeGame] : undefined;
  const navItems = useMemo(() => Object.entries(GAMES) as Array<[GameId, (typeof GAMES)[GameId]]>, []);

  useEffect(() => {
    const updateRoute = () => {
      setRoute(routeFromLocation());
      setPlayerId(playerIdFromLocation());
    };
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [playerId, route]);

  useEffect(() => {
    document.title = game
      ? `${game.label} | ${APP_NAME}`
      : route === "config"
        ? `Config | ${APP_NAME}`
        : route === "account"
          ? `Account | ${APP_NAME}`
          : route === "leaderboard"
            ? `Leaderboard | ${APP_NAME}`
            : route === "player"
              ? `Player Profile | ${APP_NAME}`
          : APP_NAME;
    setFavicon(game?.favicon ?? APP_FAVICON);
  }, [game, route]);

  return (
    <div
      className={`suite-shell ${activeGame ? `game-${activeGame}` : route === "config" || route === "account" || route === "leaderboard" || route === "player" ? "game-config" : "game-menu"}`}
      data-game={activeGame ?? undefined}
      data-skin={activeSkin}
    >
      <nav className="suite-nav" aria-label="Game navigation">
        <a className="suite-brand" href="#/" aria-label={`${APP_NAME} menu`}>
          <img className="suite-brand-mark" src="/brand/mindlab-logo-192.png" alt="" />
          <span>{APP_NAME}</span>
        </a>
        <div className="suite-tabs">
          {navItems.map(([id, item]) => {
            const Icon = item.icon;
            return (
              <a
                key={id}
                className={`suite-tab ${id === activeGame ? "is-active" : ""}`}
                href={`#${item.path}`}
                aria-current={id === activeGame ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={17} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
        <a
          className={`suite-config-button suite-leaderboard-button ${route === "leaderboard" ? "is-active" : ""}`}
          href="#/leaderboard"
          aria-label="Open leaderboard"
          aria-current={route === "leaderboard" ? "page" : undefined}
          title="Leaderboard"
        >
          <Trophy aria-hidden="true" size={18} />
        </a>
        <a
          className={`suite-config-button suite-account-button ${route === "account" ? "is-active" : ""}`}
          href="#/account"
          aria-label="Open account"
          aria-current={route === "account" ? "page" : undefined}
          title="Account"
        >
          <UserRound aria-hidden="true" size={18} />
        </a>
        <a
          className={`suite-config-button suite-settings-button ${route === "config" ? "is-active" : ""}`}
          href="#/config"
          aria-label="Open config"
          aria-current={route === "config" ? "page" : undefined}
          title="Config"
        >
          <Settings aria-hidden="true" size={18} />
        </a>
        <button
          className="suite-theme-button"
          type="button"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          aria-pressed={theme === "dark"}
          onClick={toggleTheme}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
        >
          {theme === "dark" ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
        </button>
      </nav>
      {GameComponent ? (
        <Suspense
          fallback={(
            <main className="game-route-loading" role="status">
              <span className="sr-only">Loading {game.label}</span>
            </main>
          )}
        >
          <GameComponent />
        </Suspense>
      ) : route === "config" ? (
        <ConfigView />
      ) : route === "account" ? (
        <AccountView />
      ) : route === "leaderboard" ? (
        <LeaderboardView />
      ) : route === "player" && playerId !== null ? (
        <PlayerProfileView playerId={playerId} />
      ) : (
        <MainMenu navItems={navItems} />
      )}
    </div>
  );
}

function ConfigView() {
  const [showQueensPatterns, setShowQueensPatterns] = useQueensPatternsSetting();
  const [skinGame, setSkinGame] = useState<GameId>("queens");
  const { selectedSkins, selectSkin, isSkinUnlocked } = useSkins();
  const selectedGame = GAMES[skinGame];
  const SkinGameIcon = selectedGame.icon;

  return (
    <main className="config-shell" aria-labelledby="config-title">
      <section className="config-heading">
        <h1 id="config-title">Config</h1>
        <p>Shared preferences for MindLab.</p>
      </section>

      <section className="config-panel skin-config-panel" aria-labelledby="skins-title">
        <div className="config-section-title">
          <Palette aria-hidden="true" size={21} />
          <div>
            <h2 id="skins-title">Game skins</h2>
            <span className="config-section-caption">
              <SkinGameIcon aria-hidden="true" size={15} />
              {selectedGame.label}
            </span>
          </div>
        </div>

        <div className="skin-game-tabs" role="tablist" aria-label="Choose game">
          {(Object.entries(GAMES) as Array<[GameId, (typeof GAMES)[GameId]]>).map(([gameId, item]) => {
            const Icon = item.icon;
            return (
              <button
                className="skin-game-tab"
                type="button"
                role="tab"
                aria-selected={gameId === skinGame}
                aria-label={item.label}
                title={item.label}
                key={gameId}
                onClick={() => setSkinGame(gameId)}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="skin-options" role="radiogroup" aria-label={`${selectedGame.label} skins`}>
          {GAME_SKINS[skinGame].map((skin) => {
            const unlocked = isSkinUnlocked(skinGame, skin.id);
            const selected = selectedSkins[skinGame] === skin.id;
            return (
              <button
                className="skin-option"
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!unlocked}
                key={skin.id}
                onClick={() => selectSkin(skinGame, skin.id)}
              >
                <span
                  className={`skin-preview skin-preview-${skin.preview.presentation}`}
                  aria-hidden="true"
                >
                  {skin.preview.sources.map((source, index) => (
                    <img
                      key={`${source}-${index}`}
                      src={source}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  ))}
                </span>
                <span className="skin-option-copy">
                  <strong>{skin.name}</strong>
                  <span>{skin.description}</span>
                </span>
                <span className="skin-option-status" aria-hidden="true">
                  {unlocked ? (selected ? <Check size={18} /> : null) : <Lock size={17} />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="config-panel" aria-labelledby="accessibility-title">
        <div className="config-section-title">
          <Settings aria-hidden="true" size={21} />
          <h2 id="accessibility-title">Accessibility</h2>
        </div>

        <label className="config-row">
          <span className="config-row-icon" aria-hidden="true">
            <Palette size={20} />
          </span>
          <span className="config-row-copy">
            <strong>Colorblind region patterns</strong>
            <span>Show subtle patterns on Queens regions.</span>
          </span>
          <span className="config-switch">
            <input
              type="checkbox"
              checked={showQueensPatterns}
              onChange={(event) => setShowQueensPatterns(event.target.checked)}
            />
            <span aria-hidden="true" />
          </span>
        </label>
      </section>
    </main>
  );
}

function MainMenu({
  navItems,
}: {
  navItems: Array<[GameId, (typeof GAMES)[GameId]]>;
}) {
  return (
    <main className="menu-shell" aria-labelledby="menu-title">
      <section className="menu-heading">
        <h1 id="menu-title">MindLab</h1>
        <p>Choose a game and jump straight into a fresh puzzle.</p>
      </section>

      <section className="game-picker" aria-label="Available games">
        {navItems.map(([id, item]) => {
          const Icon = item.icon;
          return (
            <a className={`game-card game-card-${id}`} href={`#${item.path}`} key={id}>
              <span className="game-card-logo" aria-hidden="true">
                <img src={item.logo} alt="" />
              </span>
              <span className="game-card-copy">
                <span className="game-card-title">
                  <Icon aria-hidden="true" size={19} />
                  {item.label}
                </span>
                <span className="game-card-description">{item.description}</span>
                <span className="game-card-meta">{item.meta}</span>
              </span>
            </a>
          );
        })}
      </section>
    </main>
  );
}
