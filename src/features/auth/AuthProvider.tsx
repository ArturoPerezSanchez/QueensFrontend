import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiPath } from "@/shared/api";

const TOKEN_KEY = "mindlab-auth-token";

export type ProfileGender = "woman" | "man" | "non_binary" | "other";

export type ProfileLinks = {
  website: string | null;
  linkedin: string | null;
  github: string | null;
  instagram: string | null;
  x: string | null;
};

export type UserProfile = {
  id: number;
  email: string;
  nickname: string;
  profile_image_url: string | null;
  nationality: string | null;
  location: string | null;
  gender: ProfileGender | null;
  bio: string | null;
  social_links: ProfileLinks;
  created_at: number;
};

export type PlayerGameSummary = {
  game: string;
  games_played: number;
  wins: number;
  win_rate: number;
  average_time_seconds: number | null;
};

export type PlayerProfile = Omit<UserProfile, "email"> & {
  stats: PlayerGameSummary[];
};

export type ProfileUpdateInput = {
  nickname?: string;
  profile_image_url?: string | null;
  nationality?: string | null;
  location?: string | null;
  gender?: ProfileGender | null;
  bio?: string | null;
  social_links?: Partial<ProfileLinks>;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

export type GameStat = {
  game: string;
  difficulty: string;
  games_played: number;
  wins: number;
  win_rate: number;
  best_time_seconds: number | null;
};

export type LeaderboardRow = GameStat & {
  user: {
    id: number;
    nickname: string;
    profile_image_url: string | null;
  };
};

export type LeaderboardSort = "played" | "wins" | "best_time";
export type LeaderboardDirection = "asc" | "desc";

export type RankedLeaderboardRow = LeaderboardRow & {
  rank: number;
};

export type LeaderboardPage = {
  rows: RankedLeaderboardRow[];
  total: number;
  total_players: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type GameResult = {
  result_id: string;
  game: string;
  difficulty: string;
  won: boolean;
  time_seconds?: number;
  assisted?: boolean;
};

export type OAuthProvider = {
  id: "google" | "facebook";
  label: string;
  enabled: boolean;
};

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  socialProviders: OAuthProvider[];
  register: (input: { email: string; password: string; nickname: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  startSocialLogin: (provider: OAuthProvider["id"]) => void;
  logout: () => void;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
  loadPlayerProfile: (userId: number) => Promise<PlayerProfile>;
  loadStats: () => Promise<GameStat[]>;
  loadLeaderboard: (input: {
    game: string;
    difficulty: string;
    sortBy: LeaderboardSort;
    direction: LeaderboardDirection;
    page: number;
    pageSize: number;
    search?: string;
  }) => Promise<LeaderboardPage>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function requestJson<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(apiPath(path), { ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail ?? "Request failed.");
  }
  return payload as T;
}

function storeSession(session: AuthResponse): void {
  window.localStorage.setItem(TOKEN_KEY, session.token);
}

function consumeOAuthRedirect(): { token: string | null; error: string | null } {
  const storedToken = window.localStorage.getItem(TOKEN_KEY);
  const queryIndex = window.location.hash.indexOf("?");
  if (queryIndex < 0) {
    return { token: storedToken, error: null };
  }

  const routeHash = window.location.hash.slice(0, queryIndex);
  const parameters = new URLSearchParams(window.location.hash.slice(queryIndex + 1));
  const oauthToken = parameters.get("auth_token");
  const oauthError = parameters.get("auth_error");
  if (!oauthToken && !oauthError) {
    return { token: storedToken, error: null };
  }

  if (oauthToken) {
    window.localStorage.setItem(TOKEN_KEY, oauthToken);
  }
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${routeHash}`,
  );
  return {
    token: oauthToken ?? storedToken,
    error: oauthError,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState(consumeOAuthRedirect);
  const [token, setToken] = useState<string | null>(initialSession.token);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState<string | null>(initialSession.error);
  const [socialProviders, setSocialProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    requestJson<OAuthProvider[]>("/auth/providers")
      .then(setSocialProviders)
      .catch(() => setSocialProviders([]));
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    requestJson<UserProfile>("/me", { method: "GET" }, token)
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
          setAuthError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          window.localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          setAuthError(error instanceof Error ? error.message : "Could not restore session.");
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
  }, [token]);

  const applySession = useCallback((session: AuthResponse) => {
    storeSession(session);
    setToken(session.token);
    setUser(session.user);
    setAuthError(null);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; nickname: string }) => {
      const session = await requestJson<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      applySession(session);
    },
    [applySession],
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const session = await requestJson<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setAuthError(null);
  }, []);

  const startSocialLogin = useCallback(
    (provider: OAuthProvider["id"]) => {
      const available = socialProviders.some((entry) => entry.id === provider && entry.enabled);
      if (!available) {
        setAuthError(`${provider === "google" ? "Google" : "Facebook"} sign-in is not configured.`);
        return;
      }
      const returnTo = encodeURIComponent(window.location.origin);
      window.location.assign(apiPath(`/auth/oauth/${provider}/start?return_to=${returnTo}`));
    },
    [socialProviders],
  );

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      const nextUser = await requestJson<UserProfile>(
        "/me",
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
        token,
      );
      setUser(nextUser);
    },
    [token],
  );

  const loadPlayerProfile = useCallback(
    (userId: number) => requestJson<PlayerProfile>(`/players/${userId}`, { method: "GET" }),
    [],
  );

  const loadStats = useCallback(() => requestJson<GameStat[]>("/stats/me", { method: "GET" }, token), [token]);

  const loadLeaderboard = useCallback(
    (input: {
      game: string;
      difficulty: string;
      sortBy: LeaderboardSort;
      direction: LeaderboardDirection;
      page: number;
      pageSize: number;
      search?: string;
    }) => {
      const params = new URLSearchParams({
        game: input.game,
        difficulty: input.difficulty,
        sort_by: input.sortBy,
        direction: input.direction,
        page: String(input.page),
        page_size: String(input.pageSize),
      });
      if (input.search) {
        params.set("search", input.search);
      }
      return requestJson<LeaderboardPage>(`/leaderboard/page?${params}`, { method: "GET" });
    },
    [],
  );

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<GameResult>).detail;
      if (!detail?.game || !detail.difficulty) {
        return;
      }
      void requestJson<GameStat>(
        "/stats/results",
        {
          method: "POST",
          body: JSON.stringify(detail),
        },
        token,
      ).catch(() => {
        // Stats are a nice-to-have path; never interrupt gameplay because sync failed.
      });
    };

    window.addEventListener("mindlab:game-result", handleResult);
    return () => window.removeEventListener("mindlab:game-result", handleResult);
  }, [token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      authError,
      socialProviders,
      register,
      login,
      startSocialLogin,
      logout,
      updateProfile,
      loadPlayerProfile,
      loadStats,
      loadLeaderboard,
    }),
    [
      authError,
      isLoading,
      loadLeaderboard,
      loadPlayerProfile,
      loadStats,
      login,
      logout,
      register,
      socialProviders,
      startSocialLogin,
      token,
      updateProfile,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}

// eslint-disable-next-line react-refresh/only-export-components
export function reportGameResult(result: Omit<GameResult, "result_id">): void {
  const resultId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  window.dispatchEvent(
    new CustomEvent<GameResult>("mindlab:game-result", {
      detail: { ...result, result_id: resultId },
    }),
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameResultReporter({
  runKey,
  completed,
  game,
  difficulty,
  won,
  time_seconds,
  assisted,
}: {
  runKey: object | null;
  completed: boolean;
} & Omit<GameResult, "result_id">): void {
  const reportedRunRef = useRef<object | null>(null);

  useEffect(() => {
    if (!runKey || !completed || reportedRunRef.current === runKey) {
      return;
    }
    reportedRunRef.current = runKey;
    reportGameResult({
      game,
      difficulty,
      won,
      time_seconds,
      assisted,
    });
  }, [assisted, completed, difficulty, game, runKey, time_seconds, won]);
}
