import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { GAME_ICONS } from "@/shared/icons/gameIcons";
import { GAME_OPTIONS, type GameId } from "@/shared/gameOptions";
import {
  type LeaderboardDirection,
  type LeaderboardPage,
  type LeaderboardSort,
  type RankedLeaderboardRow,
  useAuth,
} from "@/features/auth/AuthProvider";

type DifficultyRanking = LeaderboardPage & {
  status: "loading" | "ready" | "error";
};

type LeaderboardLoader = (input: {
  game: string;
  difficulty: string;
  sortBy: LeaderboardSort;
  direction: LeaderboardDirection;
  page: number;
  pageSize: number;
  search?: string;
}) => Promise<LeaderboardPage>;

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

function formatTime(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function readInitialGame(): GameId {
  const query = window.location.hash.split("?", 2)[1] ?? "";
  const requestedGame = new URLSearchParams(query).get("game");
  return GAME_OPTIONS.find((option) => option.id === requestedGame)?.id ?? GAME_OPTIONS[0].id;
}

function createEmptyRanking(pageSize: number): DifficultyRanking {
  return {
    rows: [],
    total: 0,
    total_players: 0,
    page: 1,
    page_size: pageSize,
    total_pages: 1,
    status: "loading",
  };
}

export function LeaderboardView() {
  const { user, loadLeaderboard } = useAuth();
  const [leaderboardGame, setLeaderboardGame] = useState<GameId>(readInitialGame);
  const [sortBy, setSortBy] = useState<LeaderboardSort>("best_time");
  const [direction, setDirection] = useState<LeaderboardDirection>("asc");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedGame = useMemo(
    () => GAME_OPTIONS.find((game) => game.id === leaderboardGame) ?? GAME_OPTIONS[0],
    [leaderboardGame],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const changeGame = (gameId: GameId) => {
    setLeaderboardGame(gameId);
    const query = new URLSearchParams({ game: gameId });
    window.history.replaceState(window.history.state, "", `#/leaderboard?${query}`);
  };

  const changeSort = (nextSort: LeaderboardSort) => {
    if (nextSort === sortBy) {
      setDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortBy(nextSort);
    setDirection(nextSort === "best_time" ? "asc" : "desc");
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const handleGameTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, gameId: GameId) => {
    const currentIndex = GAME_OPTIONS.findIndex((game) => game.id === gameId);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % GAME_OPTIONS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + GAME_OPTIONS.length) % GAME_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = GAME_OPTIONS.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextGame = GAME_OPTIONS[nextIndex];
    changeGame(nextGame.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`leaderboard-tab-${nextGame.id}`)?.focus();
    });
  };

  return (
    <main className="account-shell leaderboard-shell" aria-labelledby="leaderboard-title">
      <section className="account-heading leaderboard-heading">
        <div className="leaderboard-title-row">
          <span className="leaderboard-title-icon" aria-hidden="true">
            <Trophy size={22} />
          </span>
          <h1 id="leaderboard-title">Leaderboard</h1>
        </div>
        <p>Compare every board size and find any player&apos;s global position.</p>
      </section>

      <div className="leaderboard-game-tabs" role="tablist" aria-label="Choose game">
        {GAME_OPTIONS.map((game) => {
          const Icon = GAME_ICONS[game.id];
          const isSelected = game.id === selectedGame.id;
          return (
            <button
              className="leaderboard-game-tab"
              id={`leaderboard-tab-${game.id}`}
              key={game.id}
              type="button"
              role="tab"
              aria-controls="leaderboard-panel"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => changeGame(game.id)}
              onKeyDown={(event) => handleGameTabKeyDown(event, game.id)}
              title={game.label}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{game.label}</span>
            </button>
          );
        })}
      </div>

      <div className="leaderboard-toolbar">
        <label className="leaderboard-search">
          <span className="sr-only">Search player</span>
          <Search aria-hidden="true" size={17} />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search player"
            autoComplete="off"
          />
          {searchInput ? (
            <button type="button" onClick={clearSearch} aria-label="Clear player search" title="Clear search">
              <X aria-hidden="true" size={16} />
            </button>
          ) : null}
        </label>
        <label className="leaderboard-page-size">
          <span>Rows per table</span>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
          >
            {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <section
        className="leaderboard-levels"
        id="leaderboard-panel"
        role="tabpanel"
        aria-labelledby={`leaderboard-tab-${selectedGame.id}`}
      >
        {selectedGame.difficulties.map((difficulty) => (
          <LeaderboardLevel
            key={`${selectedGame.id}-${difficulty}-${sortBy}-${direction}-${pageSize}-${searchQuery}`}
            gameId={selectedGame.id}
            gameLabel={selectedGame.label}
            difficulty={difficulty}
            currentUserId={user?.id ?? null}
            sortBy={sortBy}
            direction={direction}
            pageSize={pageSize}
            search={searchQuery}
            loadLeaderboard={loadLeaderboard}
            onSort={changeSort}
          />
        ))}
      </section>
    </main>
  );
}

function LeaderboardLevel({
  gameId,
  gameLabel,
  difficulty,
  currentUserId,
  sortBy,
  direction,
  pageSize,
  search,
  loadLeaderboard,
  onSort,
}: {
  gameId: GameId;
  gameLabel: string;
  difficulty: string;
  currentUserId: number | null;
  sortBy: LeaderboardSort;
  direction: LeaderboardDirection;
  pageSize: number;
  search: string;
  loadLeaderboard: LeaderboardLoader;
  onSort: (sort: LeaderboardSort) => void;
}) {
  const [page, setPage] = useState(1);
  const [ranking, setRanking] = useState<DifficultyRanking>(() => createEmptyRanking(pageSize));

  useEffect(() => {
    let cancelled = false;
    setRanking((current) => ({ ...current, status: "loading" }));
    void loadLeaderboard({
      game: gameId,
      difficulty,
      sortBy,
      direction,
      page,
      pageSize,
      search: search || undefined,
    })
      .then((result) => {
        if (!cancelled) {
          setRanking({ ...result, status: "ready" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRanking({ ...createEmptyRanking(pageSize), status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [difficulty, direction, gameId, loadLeaderboard, page, pageSize, search, sortBy]);

  const visibleTotal = search ? ranking.total : ranking.total_players;

  return (
    <section
      className="leaderboard-level"
      aria-labelledby={`leaderboard-${gameId}-${difficulty}`}
      aria-busy={ranking.status === "loading"}
    >
      <header className="leaderboard-level-header">
        <div>
          <span>Board</span>
          <h2 id={`leaderboard-${gameId}-${difficulty}`}>{difficulty}</h2>
        </div>
        {ranking.status === "ready" ? (
          <span className="leaderboard-level-count">
            {visibleTotal} {search ? (visibleTotal === 1 ? "match" : "matches") : (visibleTotal === 1 ? "player" : "players")}
          </span>
        ) : null}
      </header>
      <LeaderboardTable
        ranking={ranking}
        currentUserId={currentUserId}
        sortBy={sortBy}
        direction={direction}
        gameLabel={gameLabel}
        difficulty={difficulty}
        hasSearch={Boolean(search)}
        onSort={onSort}
        onPageChange={setPage}
      />
    </section>
  );
}

function LeaderboardTable({
  ranking,
  currentUserId,
  sortBy,
  direction,
  gameLabel,
  difficulty,
  hasSearch,
  onSort,
  onPageChange,
}: {
  ranking: DifficultyRanking;
  currentUserId: number | null;
  sortBy: LeaderboardSort;
  direction: LeaderboardDirection;
  gameLabel: string;
  difficulty: string;
  hasSearch: boolean;
  onSort: (sort: LeaderboardSort) => void;
  onPageChange: (page: number) => void;
}) {
  if (ranking.status === "loading" && ranking.rows.length === 0) {
    return <p className="leaderboard-table-state" role="status">Loading rankings...</p>;
  }
  if (ranking.status === "error") {
    return <p className="leaderboard-table-state is-error">Rankings unavailable.</p>;
  }
  if (ranking.rows.length === 0) {
    return <p className="leaderboard-table-state">{hasSearch ? "No matching players." : "No ranked solves yet."}</p>;
  }

  const firstVisible = (ranking.page - 1) * ranking.page_size + 1;
  const lastVisible = firstVisible + ranking.rows.length - 1;

  return (
    <>
      <div className={`leaderboard-table-frame ${ranking.status === "loading" ? "is-loading" : ""}`}>
        <table className="leaderboard-table" aria-label={`${gameLabel} ${difficulty} leaderboard`}>
          <colgroup>
            <col className="leaderboard-rank-column" />
            <col />
            <col className="leaderboard-played-column" />
            <col className="leaderboard-wins-column" />
            <col className="leaderboard-best-column" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <SortableHeader metric="played" label="Played" sortBy={sortBy} direction={direction} onSort={onSort} />
              <SortableHeader metric="wins" label="Wins" sortBy={sortBy} direction={direction} onSort={onSort} />
              <SortableHeader metric="best_time" label="Best" sortBy={sortBy} direction={direction} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {ranking.rows.map((row) => (
              <LeaderboardPlayerRow
                key={`${row.user.id}-${row.game}-${row.difficulty}`}
                row={row}
                isCurrentPlayer={row.user.id === currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="leaderboard-pagination">
        <span>{firstVisible}-{lastVisible} of {ranking.total}</span>
        <div>
          <button
            type="button"
            onClick={() => onPageChange(ranking.page - 1)}
            disabled={ranking.page <= 1 || ranking.status === "loading"}
            aria-label={`Previous ${difficulty} page`}
            title="Previous page"
          >
            <ChevronLeft aria-hidden="true" size={17} />
          </button>
          <span aria-label={`Page ${ranking.page} of ${ranking.total_pages}`}>
            {ranking.page} / {ranking.total_pages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(ranking.page + 1)}
            disabled={ranking.page >= ranking.total_pages || ranking.status === "loading"}
            aria-label={`Next ${difficulty} page`}
            title="Next page"
          >
            <ChevronRight aria-hidden="true" size={17} />
          </button>
        </div>
      </div>
    </>
  );
}

function SortableHeader({
  metric,
  label,
  sortBy,
  direction,
  onSort,
}: {
  metric: LeaderboardSort;
  label: string;
  sortBy: LeaderboardSort;
  direction: LeaderboardDirection;
  onSort: (sort: LeaderboardSort) => void;
}) {
  const isActive = sortBy === metric;
  const SortIcon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      className="leaderboard-sort-column"
      scope="col"
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        className={isActive ? "is-active" : undefined}
        type="button"
        onClick={() => onSort(metric)}
        title={`Sort by ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        <SortIcon aria-hidden="true" size={13} />
      </button>
    </th>
  );
}

function LeaderboardPlayerRow({
  row,
  isCurrentPlayer,
}: {
  row: RankedLeaderboardRow;
  isCurrentPlayer: boolean;
}) {
  return (
    <tr className={isCurrentPlayer ? "is-current-player" : undefined}>
      <td className="leaderboard-rank">
        <span className={row.rank <= 3 ? "is-top-rank" : undefined}>{row.rank}</span>
      </td>
      <td>
        <a className="leaderboard-player" href={`#/players/${row.user.id}`}>
          {row.user.profile_image_url ? (
            <img src={row.user.profile_image_url} alt="" />
          ) : (
            <span className="leaderboard-avatar" aria-hidden="true">
              {row.user.nickname.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="leaderboard-player-name">{row.user.nickname}</span>
          {isCurrentPlayer ? <span className="leaderboard-you">You</span> : null}
        </a>
      </td>
      <td>{row.games_played}</td>
      <td>
        <span className="leaderboard-win-stat">
          <strong>{row.wins}</strong>
          <span>{row.win_rate}%</span>
        </span>
      </td>
      <td className="leaderboard-best-time">{formatTime(row.best_time_seconds)}</td>
    </tr>
  );
}
