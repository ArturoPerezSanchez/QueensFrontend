import { Trophy } from "lucide-react";

export function LeaderboardLink({
  game,
  difficulty,
}: {
  game: string;
  difficulty: string;
}) {
  const parameters = new URLSearchParams({ game, difficulty });

  return (
    <a className="win-leaderboard-link" href={`#/leaderboard?${parameters}`}>
      <Trophy aria-hidden="true" size={17} />
      View leaderboard
    </a>
  );
}
