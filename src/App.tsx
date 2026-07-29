import { useEffect, useMemo, useState } from "react";
import { Crown, LayoutGrid, Lightbulb, Moon, Palette, Route, Settings, Sun, Swords, Zap } from "lucide-react";
import { QueensGame } from "./games/queens/QueensGame";
import { TangoGame } from "./games/tango/TangoGame";
import { LightsGame } from "./games/lights/LightsGame";
import { TracksGame } from "./games/tracks/TracksGame";
import { ZipGame } from "./games/zip/ZipGame";
import { MineIslandsGame } from "./games/mine-islands/MineIslandsGame";
import { MiniChessGame } from "./games/mini-chess/MiniChessGame";
import { useQueensPatternsSetting } from "./useConfig";
import { useTheme } from "./useTheme";
import "./games/queens/styles.css";
import "./games/tango/styles.css";
import "./games/lights/styles.css";
import "./games/tracks/styles.css";
import "./games/zip/styles.css";
import "./games/mine-islands/styles.css";
import "./games/mini-chess/styles.css";

const APP_NAME = "MindLab";
const APP_FAVICON = "/brand/mindlab-favicon.png";

const GAMES = {
  queens: {
    label: "Queens",
    path: "/queens",
    favicon: "/favicon.png",
    logo: "/logo.png",
    description: "Place one queen per row, column, and region without touching.",
    meta: "4 x 4 to 10 x 10",
    icon: Crown,
    component: QueensGame,
  },
  tango: {
    label: "Tango",
    path: "/tango",
    favicon: "/games/tango/favicon.png",
    logo: "/games/tango/logo.png",
    description: "Balance suns and moons while obeying equality clues.",
    meta: "Even boards",
    icon: Moon,
    component: TangoGame,
  },
  lights: {
    label: "Lights",
    path: "/lights",
    favicon: "/games/lights/favicon.png",
    logo: "/games/lights/logo.png",
    description: "Flip tiles until every light on the board is glowing.",
    meta: "4 x 4 to 8 x 8",
    icon: Lightbulb,
    component: LightsGame,
  },
  tracks: {
    label: "Tracks",
    path: "/tracks",
    favicon: "/games/tracks/favicon.png",
    logo: "/games/tracks/logo.png",
    description: "Rotate pieces into one continuous route between endpoints.",
    meta: "Diagonal tracks",
    icon: Route,
    component: TracksGame,
  },
  zip: {
    label: "Zip",
    path: "/zip",
    favicon: "/games/zip/favicon.png",
    logo: "/games/zip/logo.png",
    description: "Draw one path through every square in numbered order.",
    meta: "Path puzzle",
    icon: Zap,
    component: ZipGame,
  },
  "mine-islands": {
    label: "Mine Islands",
    path: "/mine-islands",
    favicon: "/games/mine-islands/favicon.svg",
    logo: "/games/mine-islands/logo.svg",
    description: "Reveal clear cells and mark hidden hazards using number clues.",
    meta: "6 x 6 to 10 x 10",
    icon: LayoutGrid,
    component: MineIslandsGame,
  },
  "mini-chess": {
    label: "MiniChess",
    path: "/mini-chess",
    favicon: "/games/mini-chess/pieces/bn.svg",
    logo: "/games/mini-chess/pieces/bn.svg",
    description: "Find a short forced checkmate from a focused position.",
    meta: "Mate in 1 to 3",
    icon: Swords,
    component: MiniChessGame,
  },
} as const;

type GameId = keyof typeof GAMES;
type RouteState = GameId | "menu" | "config";

function routeFromLocation(): RouteState {
  const hashPath = window.location.hash.replace(/^#/, "").replace(/^\/+/, "");
  const path = hashPath || window.location.pathname.replace(/^\/+/, "");
  const firstSegment = path.split("/")[0].toLowerCase();
  if (firstSegment === "config") {
    return "config";
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
  const { theme, toggleTheme } = useTheme();
  const activeGame = route in GAMES ? (route as GameId) : null;
  const game = activeGame ? GAMES[activeGame] : null;
  const GameComponent = game?.component;
  const navItems = useMemo(() => Object.entries(GAMES) as Array<[GameId, (typeof GAMES)[GameId]]>, []);

  useEffect(() => {
    const updateRoute = () => setRoute(routeFromLocation());
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  useEffect(() => {
    document.title = game ? `${game.label} | ${APP_NAME}` : route === "config" ? `Config | ${APP_NAME}` : APP_NAME;
    setFavicon(game?.favicon ?? APP_FAVICON);
  }, [game, route]);

  return (
    <div className={`suite-shell ${activeGame ? `game-${activeGame}` : route === "config" ? "game-config" : "game-menu"}`}>
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
          className={`suite-config-button ${route === "config" ? "is-active" : ""}`}
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
      {GameComponent ? <GameComponent /> : route === "config" ? <ConfigView /> : <MainMenu navItems={navItems} />}
    </div>
  );
}

function ConfigView() {
  const [showQueensPatterns, setShowQueensPatterns] = useQueensPatternsSetting();

  return (
    <main className="config-shell" aria-labelledby="config-title">
      <section className="config-heading">
        <h1 id="config-title">Config</h1>
        <p>Shared preferences for MindLab.</p>
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
