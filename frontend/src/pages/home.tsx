import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionTitle, StatPill } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { findTeam, findPlayer } from "@/lib/mockdb";
import { Trophy, TrendingUp, Award, Calendar, Flame, Activity } from "lucide-react";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Home — Stadium Night" }] }),
  component: Home,
});

function Home() {
  const user = useApp((s) => s.user);
  const matches = useApp((s) => s.matches);
  const tournaments = useApp((s) => s.tournaments);
  const feed = useApp((s) => s.feed);

  const live = matches.filter((m) => m.status === "live").slice(0, 5);
  const upcoming = matches.filter((m) => m.status === "upcoming").slice(0, 5);
  const liveTournaments = tournaments.filter((t) => t.status === "live");

  return (
    <AppShell title="Home">
      {/* Greeting */}
      <div className="glass-card rounded-2xl p-5 border border-border/40 shadow-card">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</div>
        <div className="font-display text-3xl mt-1">{user?.name?.split(" ")[0] || "Player"}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {live.length} live · {upcoming.length} upcoming · {tournaments.length} tournaments
        </div>
        <div className="flex justify-around items-center mt-6">
          <CircularProgress
            label="Matches"
            value={user ? (findPlayer(user.playerId)?.stats.matches ?? 0) : 0}
            max={50}
            colorClass="text-accent"
            glowColor="rgba(0, 209, 255, 0.4)"
          />
          <CircularProgress
            label="Runs"
            value={user ? (findPlayer(user.playerId)?.stats.runs ?? 0) : 0}
            max={2000}
            colorClass="text-primary"
            glowColor="rgba(195, 244, 0, 0.4)"
          />
          <CircularProgress
            label="Wickets"
            value={user ? (findPlayer(user.playerId)?.stats.wickets ?? 0) : 0}
            max={50}
            colorClass="text-destructive"
            glowColor="rgba(239, 68, 68, 0.4)"
          />
        </div>
      </div>

      {/* Live now */}
      {live.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link to="/matches" className="text-xs text-primary hover:underline">
                View all
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive live-pulse" />
              Live now
            </span>
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            {live.map((m) => {
              const a = findTeam(m.teamAId)!,
                b = findTeam(m.teamBId)!;
              const aInn = m.innings.find((i) => i.battingTeamId === a.id);
              const bInn = m.innings.find((i) => i.battingTeamId === b.id);
              return (
                <Link
                  key={m.id}
                  to="/matches/$matchId"
                  params={{ matchId: m.id }}
                  className="min-w-[280px] glass-card neon-glow-primary rounded-2xl p-4 shadow-card hover:border-primary/60 transition duration-300"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-destructive font-semibold">
                    <span className="flex items-center gap-1 text-red-500 font-bold live-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      Live
                    </span>
                    <span className="text-muted-foreground">{m.venue}</span>
                  </div>
                  <ScoreLine team={a} inn={aInn} />
                  <ScoreLine team={b} inn={bInn} />
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Live tournaments */}
      {liveTournaments.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link to="/tournaments" className="text-xs text-primary hover:underline">
                All
              </Link>
            }
          >
            Tournaments
          </SectionTitle>
          <div className="grid gap-3">
            {liveTournaments.map((t) => (
              <Link
                key={t.id}
                to="/tournaments/$tournamentId"
                params={{ tournamentId: t.id }}
                className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:border-primary/60 hover:shadow-[0_0_15px_rgba(195,244,0,0.15)] transition duration-300 group"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.format} · {t.teamIds.length} teams · {t.prizePool}
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-red-500 font-bold live-pulse">
                  Live
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Activity feed */}
      <SectionTitle>Activity</SectionTitle>
      <div className="grid gap-3">
        {feed.map((f, idx) => {
          const Icon =
            f.type === "match"
              ? Activity
              : f.type === "milestone"
                ? Flame
                : f.type === "achievement"
                  ? Award
                  : Calendar;

          const isLatest = idx === 0;

          return (
            <div
              key={f.id}
              className={`glass-card rounded-xl p-4 flex gap-3 transition-all duration-300 ${
                isLatest ? "neon-glow-primary border-l-4 border-l-primary" : "border-l-4 border-l-accent/50"
              }`}
            >
              <div
                className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
                  isLatest ? "bg-primary/10" : "bg-accent/10"
                }`}
              >
                <Icon className={`h-5 w-5 ${isLatest ? "text-primary" : "text-accent"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground">{f.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{f.body}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-1.5 uppercase tracking-wider">
                  {f.time} · {f.meta}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upcoming */}
      <SectionTitle>Upcoming matches</SectionTitle>
      <div className="grid gap-2">
        {upcoming.map((m) => {
          const a = findTeam(m.teamAId)!,
            b = findTeam(m.teamBId)!;
          return (
            <Link
              key={m.id}
              to="/matches/$matchId"
              params={{ matchId: m.id }}
              className="glass-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 hover:shadow-[0_0_10px_rgba(195,244,0,0.05)] transition duration-300"
            >
              <div className="text-center px-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m.date.slice(5)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {a.shortName} vs {b.shortName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.venue} · {m.overs} ov
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function CircularProgress({
  value,
  max,
  label,
  colorClass = "text-primary",
  glowColor = "rgba(195,244,0,0.4)",
}: {
  value: number;
  max: number;
  label: string;
  colorClass?: string;
  glowColor?: string;
}) {
  const radius = 24;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius; // ~150.8
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-14 h-14 mb-2">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            className="text-muted/10"
            cx="28"
            cy="28"
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
          />
          <circle
            className={`${colorClass} transition-all duration-1000 ease-out`}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              filter: `drop-shadow(0 0 4px ${glowColor})`,
            }}
            cx="28"
            cy="28"
            fill="transparent"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-sm text-foreground">{value}</span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function ScoreLine({
  team,
  inn,
}: {
  team: { shortName: string; name: string; color: string };
  inn?: { runs: number; wickets: number; overs: number };
}) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-lg grid place-items-center font-display text-sm"
          style={{ backgroundColor: team.color, color: "#0A1628" }}
        >
          {team.shortName.slice(0, 2)}
        </div>
        <div className="text-sm font-medium">{team.shortName}</div>
      </div>
      <div className="font-display text-xl">
        {inn ? `${inn.runs}/${inn.wickets}` : "—"}
        {inn && <span className="text-xs text-muted-foreground ml-1">({inn.overs})</span>}
      </div>
    </div>
  );
}

