import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  CalendarDays,
  Clock3,
  Flag,
  Gamepad2,
  Github,
  Globe2,
  Instagram,
  Linkedin,
  MapPin,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  type PlayerProfile,
  type ProfileGender,
  type ProfileLinks,
  useAuth,
} from "@/features/auth/AuthProvider";
import { GAME_OPTIONS, type GameId } from "@/shared/gameOptions";

const GAME_LOGOS: Record<GameId, string> = {
  queens: "/games/queens/logo.png",
  tango: "/games/tango/logo.png",
  lights: "/games/lights/logo.png",
  tracks: "/games/tracks/logo.png",
  zip: "/games/zip/logo.png",
  "mine-islands": "/games/mine-islands/logo.svg",
  "mini-chess": "/games/mini-chess/skins/club/bn.svg",
};

const GENDER_LABELS: Record<ProfileGender, string> = {
  woman: "Woman",
  man: "Man",
  non_binary: "Non-binary",
  other: "Other",
};

const LINK_DEFINITIONS: Array<{
  key: keyof ProfileLinks;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "website", label: "Website", icon: Globe2 },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "github", label: "GitHub", icon: Github },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "x", label: "X", icon: AtSign },
];

function formatTime(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function formatMemberSince(createdAt: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(
    new Date(createdAt * 1000),
  );
}

export function PlayerProfileView({ playerId }: { playerId: number }) {
  const { loadPlayerProfile } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void loadPlayerProfile(playerId)
      .then((result) => {
        if (!cancelled) {
          setProfile(result);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setProfile(null);
          setError(reason instanceof Error ? reason.message : "Could not load this player.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadPlayerProfile, playerId]);

  const statsByGame = useMemo(
    () => new Map(profile?.stats.map((stat) => [stat.game, stat]) ?? []),
    [profile],
  );

  if (isLoading) {
    return <ProfileState copy="Loading player profile..." />;
  }
  if (!profile || error) {
    return <ProfileState copy={error ?? "Player not found."} isError />;
  }

  const socialLinks = LINK_DEFINITIONS.flatMap((definition) => {
    const url = profile.social_links[definition.key];
    return url ? [{ ...definition, url }] : [];
  });

  return (
    <main className="player-profile-shell" aria-labelledby="player-profile-title">
      <a className="player-profile-back" href="#/leaderboard">
        <ArrowLeft aria-hidden="true" size={17} />
        Leaderboard
      </a>

      <section className="player-profile-summary">
        {profile.profile_image_url ? (
          <img className="player-profile-avatar" src={profile.profile_image_url} alt={`${profile.nickname}'s profile`} />
        ) : (
          <span className="player-profile-avatar is-placeholder" aria-hidden="true">
            {profile.nickname.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="player-profile-copy">
          <h1 id="player-profile-title">{profile.nickname}</h1>
          <div className="player-profile-meta">
            {profile.nationality ? (
              <span><Flag aria-hidden="true" size={15} />{profile.nationality}</span>
            ) : null}
            {profile.location ? (
              <span><MapPin aria-hidden="true" size={15} />{profile.location}</span>
            ) : null}
            {profile.gender ? (
              <span><UserRound aria-hidden="true" size={15} />{GENDER_LABELS[profile.gender]}</span>
            ) : null}
            <span><CalendarDays aria-hidden="true" size={15} />Joined {formatMemberSince(profile.created_at)}</span>
          </div>
          {profile.bio ? <p>{profile.bio}</p> : null}
          {socialLinks.length > 0 ? (
            <div className="player-social-links" aria-label="Player links">
              {socialLinks.map(({ key, label, icon: Icon, url }) => (
                <a key={key} href={url} target="_blank" rel="noreferrer">
                  <Icon aria-hidden="true" size={16} />
                  {label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="player-stats-section" aria-labelledby="player-stats-title">
        <header>
          <div>
            <h2 id="player-stats-title">Game stats</h2>
            <p>All board sizes combined.</p>
          </div>
        </header>
        <div className="player-game-grid">
          {GAME_OPTIONS.map((game) => {
            const stat = statsByGame.get(game.id);
            return (
              <article className={`player-game-card player-game-${game.id}`} key={game.id}>
                <header>
                  <span className="player-game-logo">
                    <img src={GAME_LOGOS[game.id]} alt="" />
                  </span>
                  <h3>{game.label}</h3>
                </header>
                <div className="player-game-primary-stats">
                  <div>
                    <Trophy aria-hidden="true" size={17} />
                    <strong>{stat?.wins ?? 0}</strong>
                    <span>Total wins</span>
                  </div>
                  <div>
                    <Clock3 aria-hidden="true" size={17} />
                    <strong>{formatTime(stat?.average_time_seconds ?? null)}</strong>
                    <span>Average time</span>
                  </div>
                </div>
                <footer>
                  <span><Gamepad2 aria-hidden="true" size={14} />{stat?.games_played ?? 0} played</span>
                  <span>{stat?.win_rate ?? 0}% win rate</span>
                </footer>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function ProfileState({ copy, isError = false }: { copy: string; isError?: boolean }) {
  return (
    <main className="player-profile-shell">
      <a className="player-profile-back" href="#/leaderboard">
        <ArrowLeft aria-hidden="true" size={17} />
        Leaderboard
      </a>
      <section className={`player-profile-state ${isError ? "is-error" : ""}`} role={isError ? "alert" : "status"}>
        <UserRound aria-hidden="true" size={28} />
        <p>{copy}</p>
      </section>
    </main>
  );
}
