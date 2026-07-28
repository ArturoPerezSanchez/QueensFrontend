import { useEffect, useMemo, useState } from "react";
import { Crown, Grid2X2, Lightbulb, Moon, Route, Sparkles, Zap } from "lucide-react";
import { QueensGame } from "./games/queens/QueensGame";
import { TangoGame } from "./games/tango/TangoGame";
import { LightsGame } from "./games/lights/LightsGame";
import { TracksGame } from "./games/tracks/TracksGame";
import { ZipGame } from "./games/zip/ZipGame";
import "./games/queens/styles.css";
import "./games/tango/styles.css";
import "./games/lights/styles.css";
import "./games/tracks/styles.css";
import "./games/zip/styles.css";

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
} as const;

type GameId = keyof typeof GAMES;
type RouteState = GameId | "menu";

function routeFromLocation(): RouteState {
  const hashPath = window.location.hash.replace(/^#/, "").replace(/^\/+/, "");
  const path = hashPath || window.location.pathname.replace(/^\/+/, "");
  const firstSegment = path.split("/")[0].toLowerCase();
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
  const activeGame = route === "menu" ? null : route;
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
    document.title = game ? `${game.label} | Logic Games` : "Logic Games";
    setFavicon(game?.favicon ?? "/favicon.png");
  }, [game]);

  return (
    <div className={`suite-shell ${activeGame ? `game-${activeGame}` : "game-menu"}`}>
      <nav className="suite-nav" aria-label="Game navigation">
        <a className="suite-brand" href="#/" aria-label="Logic Games menu">
          <Grid2X2 aria-hidden="true" size={19} />
          <span>Logic Games</span>
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
      </nav>
      {GameComponent ? <GameComponent /> : <MainMenu navItems={navItems} />}
    </div>
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
        <div className="menu-kicker">
          <Sparkles aria-hidden="true" size={18} />
          <span>Puzzle suite</span>
        </div>
        <h1 id="menu-title">Choose a game</h1>
        <p>Pick a board and jump straight into a fresh puzzle.</p>
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
