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
      <div className="gradient-card rounded-2xl p-5 border border-border shadow-card">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Welcome back</div>
        <div className="font-display text-3xl mt-1">{user?.name?.split(" ")[0] || "Player"}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {live.length} live · {upcoming.length} upcoming · {tournaments.length} tournaments
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatPill
            label="Matches"
            value={user ? (findPlayer(user.playerId)?.stats.matches ?? 0) : 0}
          />
          <StatPill
            label="Runs"
            value={user ? (findPlayer(user.playerId)?.stats.runs ?? 0) : 0}
            accent
          />
          <StatPill
            label="Wickets"
            value={user ? (findPlayer(user.playerId)?.stats.wickets ?? 0) : 0}
          />
        </div>
      </div>

      {/* Live now */}
      {live.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link to="/matches" className="text-xs text-primary">
                View all
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              Live now
            </span>
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4">
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
                  className="min-w-[260px] gradient-card border border-border rounded-2xl p-4 shadow-card hover:border-primary/40 transition"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-destructive font-semibold">
                    <span>● Live</span>
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
              <Link to="/tournaments" className="text-xs text-primary">
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
                className="gradient-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/15 grid place-items-center">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.format} · {t.teamIds.length} teams · {t.prizePool}
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-destructive font-bold">
                  Live
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Activity feed */}
      <SectionTitle>Activity</SectionTitle>
      <div className="grid gap-2">
        {feed.map((f) => {
          const Icon =
            f.type === "match"
              ? Activity
              : f.type === "milestone"
                ? Flame
                : f.type === "achievement"
                  ? Award
                  : Calendar;
          return (
            <div key={f.id} className="bg-elevated border border-border rounded-xl p-4 flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{f.title}</div>
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
              className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
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
