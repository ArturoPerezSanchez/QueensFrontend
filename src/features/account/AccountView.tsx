import { useEffect, useState, type FormEvent } from "react";
import { BarChart3, ExternalLink, Link, LogIn, LogOut, UserRound } from "lucide-react";
import { type GameStat, type ProfileGender, useAuth } from "@/features/auth/AuthProvider";
import { GAME_LABELS } from "@/shared/gameOptions";

function formatTime(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function optionalValue(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

export function AccountView() {
  const {
    user,
    isLoading,
    authError,
    socialProviders,
    register,
    login,
    startSocialLogin,
    logout,
    updateProfile,
    loadStats,
  } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [nationality, setNationality] = useState("");
  const [location, setLocation] = useState("");
  const [gender, setGender] = useState<ProfileGender | "">("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<GameStat[]>([]);
  const enabledProviders = socialProviders.filter((provider) => provider.enabled);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setProfileImageUrl(user.profile_image_url ?? "");
      setNationality(user.nationality ?? "");
      setLocation(user.location ?? "");
      setGender(user.gender ?? "");
      setBio(user.bio ?? "");
      setWebsiteUrl(user.social_links.website ?? "");
      setLinkedinUrl(user.social_links.linkedin ?? "");
      setGithubUrl(user.social_links.github ?? "");
      setInstagramUrl(user.social_links.instagram ?? "");
      setXUrl(user.social_links.x ?? "");
      void loadStats().then(setStats).catch(() => setStats([]));
    } else {
      setStats([]);
    }
  }, [loadStats, user]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register({ email, password, nickname });
      } else {
        await login({ email, password });
      }
      setPassword("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not authenticate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfile = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await updateProfile({
        nickname,
        profile_image_url: optionalValue(profileImageUrl),
        nationality: optionalValue(nationality),
        location: optionalValue(location),
        gender: gender || null,
        bio: optionalValue(bio),
        social_links: {
          website: optionalValue(websiteUrl),
          linkedin: optionalValue(linkedinUrl),
          github: optionalValue(githubUrl),
          instagram: optionalValue(instagramUrl),
          x: optionalValue(xUrl),
        },
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="account-shell" aria-labelledby="account-title">
      <section className="account-heading">
        <h1 id="account-title">Account</h1>
        <p>Play as a guest, or sign in to keep your profile and game history.</p>
      </section>

      {user ? (
        <section className="account-grid">
          <form className="account-panel profile-editor" onSubmit={handleProfile}>
            <div className="account-panel-title">
              <UserRound aria-hidden="true" size={20} />
              <h2>Profile</h2>
            </div>
            <div className="profile-row">
              {user.profile_image_url ? (
                <img src={user.profile_image_url} alt={`${user.nickname}'s profile`} />
              ) : (
                <UserRound aria-hidden="true" size={34} />
              )}
              <div>
                <strong>{user.nickname}</strong>
                <span>{user.email}</span>
              </div>
            </div>

            <div className="profile-form-section">
              <h3>Basic information</h3>
              <div className="account-field-grid">
                <label>
                  <span>Nickname</span>
                  <input value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={32} />
                </label>
                <label>
                  <span>Profile image URL</span>
                  <input value={profileImageUrl} onChange={(event) => setProfileImageUrl(event.target.value)} type="url" placeholder="https://..." />
                </label>
                <label>
                  <span>Nationality</span>
                  <input value={nationality} onChange={(event) => setNationality(event.target.value)} maxLength={56} />
                </label>
                <label>
                  <span>Location</span>
                  <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={80} placeholder="City, country" />
                </label>
                <label>
                  <span>Gender</span>
                  <select value={gender} onChange={(event) => setGender(event.target.value as ProfileGender | "")}>
                    <option value="">Not specified</option>
                    <option value="woman">Woman</option>
                    <option value="man">Man</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label>
                <span>Description</span>
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={320} rows={4} />
                <small>{bio.length}/320</small>
              </label>
            </div>

            <div className="profile-form-section">
              <div className="profile-form-section-title">
                <Link aria-hidden="true" size={16} />
                <h3>Links</h3>
              </div>
              <div className="account-field-grid">
                <ProfileLinkField label="Website" value={websiteUrl} onChange={setWebsiteUrl} />
                <ProfileLinkField label="LinkedIn" value={linkedinUrl} onChange={setLinkedinUrl} />
                <ProfileLinkField label="GitHub" value={githubUrl} onChange={setGithubUrl} />
                <ProfileLinkField label="Instagram" value={instagramUrl} onChange={setInstagramUrl} />
                <ProfileLinkField label="X" value={xUrl} onChange={setXUrl} />
              </div>
            </div>

            {formError && <p className="account-error">{formError}</p>}
            <div className="account-actions">
              <button className="primary-action" type="submit" disabled={isSubmitting}>Save</button>
              <a className="secondary-action" href={`#/players/${user.id}`}>
                <ExternalLink aria-hidden="true" size={17} />
                Public profile
              </a>
              <button className="secondary-action" type="button" onClick={logout}>
                <LogOut aria-hidden="true" size={17} />
                Sign out
              </button>
            </div>
          </form>

          <section className="account-panel">
            <div className="account-panel-title">
              <BarChart3 aria-hidden="true" size={20} />
              <h2>My stats</h2>
            </div>
            <StatsTable rows={stats} emptyCopy="Solve a puzzle while signed in to start tracking stats." />
          </section>
        </section>
      ) : (
        <section className="account-grid">
          <form className="account-panel" onSubmit={handleAuth}>
            <div className="account-panel-title">
              <UserRound aria-hidden="true" size={20} />
              <h2>{mode === "register" ? "Create account" : "Sign in"}</h2>
            </div>
            <div className="segmented-control" role="tablist" aria-label="Account mode">
              <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>Sign in</button>
              <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>Register</button>
            </div>
            {enabledProviders.length > 0 && (
              <>
                <div className="social-login-row">
                  {enabledProviders.map((provider) => (
                    <button
                      className="secondary-action"
                      type="button"
                      key={provider.id}
                      onClick={() => startSocialLogin(provider.id)}
                    >
                      <LogIn aria-hidden="true" size={17} />
                      Continue with {provider.label}
                    </button>
                  ))}
                </div>
                <div className="account-divider"><span>or</span></div>
              </>
            )}
            {mode === "register" && (
              <label>
                <span>Nickname</span>
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={32} required />
              </label>
            )}
            <label>
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              <span>Password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={mode === "register" ? 8 : 1} required />
            </label>
            {(formError || authError) && <p className="account-error">{formError ?? authError}</p>}
            <button className="primary-action" type="submit" disabled={isLoading || isSubmitting}>
              {mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

function ProfileLinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type="url" placeholder="https://..." />
    </label>
  );
}

function StatsTable({ rows, emptyCopy }: { rows: GameStat[]; emptyCopy: string }) {
  if (rows.length === 0) {
    return <p className="account-note">{emptyCopy}</p>;
  }

  return (
    <div className="stats-table" role="table" aria-label="Player stats">
      <div role="row">
        <span>Game</span>
        <span>Level</span>
        <span>Played</span>
        <span>Wins</span>
        <span>Best</span>
      </div>
      {rows.map((row) => (
        <div role="row" key={`${row.game}-${row.difficulty}`}>
          <span>{GAME_LABELS[row.game] ?? row.game}</span>
          <span>{row.difficulty}</span>
          <span>{row.games_played}</span>
          <span>{row.wins} ({row.win_rate}%)</span>
          <span>{formatTime(row.best_time_seconds)}</span>
        </div>
      ))}
    </div>
  );
}
