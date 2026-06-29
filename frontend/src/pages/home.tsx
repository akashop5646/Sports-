import { Link } from "react-router-dom";
import { AppShell, SectionTitle, StatPill } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getHomeData, getTeams, getPlayer } from "@/lib/api";
import { useApp } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, 
  TrendingUp, 
  Award, 
  Calendar, 
  Flame, 
  Activity, 
  User, 
  Shield, 
  Target, 
  Sparkles,
  ChevronRight,
  Zap,
  Star
} from "lucide-react";
import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const user = useApp((s) => s.user);

  useEffect(() => {
    document.title = "Home — Stadium Night";
  }, []);

  // Queries
  const { data: homeData, isLoading: loadingHome } = useQuery({
    queryKey: ["home-data", user?.playerId],
    queryFn: () => getHomeData({ data: user?.playerId }),
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["teams"],
    queryFn: () => getTeams(),
  });

  const { data: player, isLoading: loadingPlayer } = useQuery({
    queryKey: ["player", user?.playerId],
    queryFn: () => getPlayer({ data: user?.playerId }),
    enabled: !!user && !!user.playerId,
  });

  const isLoading = loadingHome || loadingTeams || loadingPlayer;

  if (isLoading || !homeData) {
    return (
      <AppShell title="Home">
        <div className="flex justify-center items-center py-24">
          <div className="h-10 w-10 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      </AppShell>
    );
  }

  const { liveMatches = [], upcomingMatches = [], liveTournaments = [], tournamentsCount = 0, feed = [], playerStats } = homeData;

  const findTeamInList = (teamId: string) =>
    teams.find((t: any) => t.id === teamId) || { shortName: "UNK", name: "Unknown", color: "#666" };

  // Calculate Batting Stats
  const runs = player?.stats?.runs || 0;
  const innings = player?.stats?.innings || 0;
  const notOuts = player?.stats?.notOuts || 0;
  const ballsFaced = player?.stats?.ballsFaced || 0;
  const battingAvg = (innings - notOuts) > 0 ? (runs / (innings - notOuts)).toFixed(2) : "—";
  const battingSR = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(2) : "—";

  // Calculate Bowling Stats
  const wickets = player?.stats?.wickets || 0;
  const ballsBowled = player?.stats?.ballsBowled || 0;
  const runsConceded = player?.stats?.runsConceded || 0;
  const oversBowled = ballsBowled > 0 ? `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}` : "0";
  const bowlingEcon = ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(2) : "—";
  const bowlingAvg = wickets > 0 ? (runsConceded / wickets).toFixed(2) : "—";

  return (
    <AppShell title="Home">
      {/* Cricketer Premium Profile Card */}
      <div className="gradient-card rounded-2xl p-5 border border-border/40 shadow-card flex flex-col gap-5 relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 right-0 h-40 w-40 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        {/* Profile Info Header */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0 h-16 w-16">
            <Avatar className="h-full w-full rounded-2xl border border-primary/20 bg-primary/10">
              {(player?.picture || user?.picture) && (
                <AvatarImage 
                  src={player?.picture || user?.picture} 
                  alt={player?.name || user?.name} 
                  className="rounded-2xl h-full w-full object-cover" 
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-display font-bold rounded-2xl flex items-center justify-center h-full w-full">
                {player?.initials || user?.avatar || "P"}
              </AvatarFallback>
            </Avatar>
            {player?.jersey && (
              <span className="absolute -bottom-1 -right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-bold font-sans z-10">
                #{player.jersey}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-primary font-semibold flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {player?.role || "Player"}
            </div>
            <div className="font-display text-2xl mt-0.5 truncate text-foreground">{player?.name || user?.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {player?.city ? `${player.city}, ` : ""}{player?.country || "India"}
            </div>
          </div>
        </div>

        {/* Highlight Progress Indicators */}
        <div className="grid grid-cols-3 gap-2.5 border-t border-b border-border/20 py-4 my-1">
          <StatCard
            letter="MAT"
            label="Matches"
            value={player?.stats?.matches || 0}
            theme="cyan"
          />
          <StatCard
            letter="RUN"
            label="Runs"
            value={player?.stats?.runs || 0}
            theme="lime"
          />
          <StatCard
            letter="WKT"
            label="Wickets"
            value={player?.stats?.wickets || 0}
            theme="red"
          />
        </div>

        {/* Detailed Stats Tabs */}
        <Tabs defaultValue="batting" className="w-full">
          <TabsList className="grid grid-cols-2 bg-elevated/50 p-1 rounded-xl">
            <TabsTrigger value="batting" className="text-xs font-semibold">Batting & Fielding</TabsTrigger>
            <TabsTrigger value="bowling" className="text-xs font-semibold">Bowling Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="batting" className="grid grid-cols-2 gap-2.5 mt-3 animate-fade-in">
            <StatItem labelAbbr="INN" label="Innings" value={innings} theme="lime" />
            <StatItem labelAbbr="HS" label="High Score" value={player?.stats?.highScore || 0} theme="lime" />
            <StatItem labelAbbr="AVG" label="Average" value={battingAvg} theme="lime" />
            <StatItem labelAbbr="SR" label="Strike Rate" value={battingSR} theme="lime" />
            <StatItem labelAbbr="N.O" label="Not Outs" value={notOuts} theme="green" />
            <StatItem labelAbbr="50s" label="50s / 100s" value={`${player?.stats?.fifties || 0} / ${player?.stats?.hundreds || 0}`} theme="lime" />
            <StatItem labelAbbr="BND" label="4s / 6s" value={`${player?.stats?.fours || 0} / ${player?.stats?.sixes || 0}`} theme="lime" />
            <StatItem labelAbbr="CTH" label="Catches" value={player?.stats?.catches || 0} theme="green" />
          </TabsContent>

          <TabsContent value="bowling" className="grid grid-cols-2 gap-2.5 mt-3 animate-fade-in">
            <StatItem labelAbbr="OVR" label="Overs" value={oversBowled} theme="red" />
            <StatItem labelAbbr="WKT" label="Wickets" value={wickets} theme="red" />
            <StatItem labelAbbr="ECON" label="Economy" value={bowlingEcon} theme="cyan" />
            <StatItem labelAbbr="AVG" label="Bowling Avg" value={bowlingAvg} theme="cyan" />
            <StatItem labelAbbr="BBI" label="Best Bowling" value={player?.stats?.bestBowling || "—"} theme="red" />
            <StatItem labelAbbr="RC" label="Runs Conceded" value={runsConceded} theme="red" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Live now */}
      {liveMatches.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link to="/matches" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-destructive live-pulse" />
              Live now
            </span>
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
          {liveMatches.map((m: any, mi: number) => {
              const a = findTeamInList(m.teamAId);
              const b = findTeamInList(m.teamBId);
              const aInn = m.innings?.find((i: any) => i.battingTeamId === a.id);
              const bInn = m.innings?.find((i: any) => i.battingTeamId === b.id);
              return (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="min-w-[280px] glass-card neon-glow-primary rounded-2xl p-4 shadow-card hover:border-primary/60 transition duration-300 shrink-0 animate-fade-up tap-scale"
                  style={{ animationDelay: `${mi * 80}ms` }}
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
              <Link to="/tournaments" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                All <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            Tournaments
          </SectionTitle>
          <div className="grid gap-3">
            {liveTournaments.map((t: any, ti: number) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:border-primary/60 hover:shadow-[0_0_15px_rgba(195,244,0,0.15)] transition duration-300 group animate-fade-up tap-scale"
                style={{ animationDelay: `${ti * 70}ms` }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 grid place-items-center group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.format} · {t.teamIds?.length || 0} teams · {t.prizePool}
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
      <div className="grid gap-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {feed.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No recent activity.</div>
        ) : (
          feed.map((f: any, idx: number) => {
            const Icon =
              f.type === "match"
                ? Activity
                : f.type === "milestone"
                  ? Flame
                  : f.type === "achievement"
                    ? Award
                    : Calendar;

            const isLatest = idx === 0;

            const itemContent = (
              <>
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
                  <div className="text-[10px] text-muted-foreground/70 mt-1.5 uppercase tracking-wider flex items-center gap-1 flex-wrap">
                    <span>{f.time}</span>
                    <span>·</span>
                    <span>{f.meta}</span>
                    {f.organizer && (
                      <>
                        <span>·</span>
                        <span className="text-primary font-semibold">By {f.organizer}</span>
                      </>
                    )}
                  </div>
                </div>
              </>
            );

            const cardClasses = `glass-card rounded-xl p-4 flex gap-3 transition-all duration-300 ${
              isLatest ? "neon-glow-primary border-l-4 border-l-primary" : "border-l-4 border-l-accent/50"
            } ${f.tournamentId ? "hover:border-primary/40 hover:shadow-[0_0_15px_rgba(195,244,0,0.1)] cursor-pointer" : ""}`;

            const delay = {};

            if (f.tournamentId) {
              return (
                <Link
                  key={f.id || f._id}
                  to={`/tournaments/${f.tournamentId}`}
                  className={cardClasses}
                  style={delay}
                >
                  {itemContent}
                </Link>
              );
            }

            return (
              <div
                key={f.id || f._id}
                className={cardClasses}
                style={delay}
              >
                {itemContent}
              </div>
            );
          })
        )}
      </div>

      {/* Upcoming */}
      {upcomingMatches.length > 0 && (
        <>
          <SectionTitle>Upcoming matches</SectionTitle>
          <div className="grid gap-2">
            {upcomingMatches.map((m: any, ui: number) => {
              const a = findTeamInList(m.teamAId);
              const b = findTeamInList(m.teamBId);
              return (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="glass-card rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 hover:shadow-[0_0_10px_rgba(195,244,0,0.05)] transition duration-300 animate-fade-up tap-scale"
                  style={{ animationDelay: `${ui * 50}ms` }}
                >
                  <div className="text-center px-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {m.date?.slice(5)}
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
        </>
      )}
    </AppShell>
  );
}

function StatCard({
  letter,
  label,
  value,
  theme = "cyan",
}: {
  letter: string;
  label: string;
  value: number;
  theme?: "cyan" | "lime" | "red";
}) {
  const active = value > 0;
  
  let themeClasses = "border-border/20 bg-elevated/35 opacity-60";
  let letterColor = "text-muted-foreground bg-foreground/5";
  let valColor = "text-foreground/75";

  if (active) {
    if (theme === "cyan") {
      themeClasses = "border-accent/30 bg-accent/5 shadow-[0_0_15px_rgba(0,209,255,0.12)]";
      letterColor = "text-accent bg-accent/15";
      valColor = "text-accent font-bold";
    } else if (theme === "lime") {
      themeClasses = "border-primary/30 bg-primary/5 shadow-[0_0_15px_rgba(195,244,0,0.12)]";
      letterColor = "text-primary bg-primary/15";
      valColor = "text-primary font-bold";
    } else if (theme === "red") {
      themeClasses = "border-destructive/30 bg-destructive/5 shadow-[0_0_15px_rgba(239,68,68,0.12)]";
      letterColor = "text-destructive bg-destructive/15";
      valColor = "text-destructive font-bold";
    }
  }

  return (
    <div className={`glass-card rounded-2xl py-3 px-2 flex flex-col items-center justify-center text-center border relative overflow-hidden group hover:scale-[1.03] transition-all duration-300 ${themeClasses}`}>
      {/* Background soft glow */}
      <div className="absolute -top-6 -right-6 h-12 w-12 rounded-full bg-foreground/5 group-hover:scale-150 transition-all duration-500" />
      
      {/* Letter Badge */}
      <div className={`h-9 w-9 rounded-xl grid place-items-center mb-2 font-display font-bold text-xs group-hover:rotate-6 transition-transform duration-300 ${letterColor}`}>
        {letter}
      </div>
      
      {/* Label */}
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      
      {/* Value */}
      <span className={`font-display text-xl mt-1 tracking-tight ${valColor}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function StatItem({
  labelAbbr,
  label,
  value,
  theme = "lime",
}: {
  labelAbbr: string;
  label: string;
  value: string | number;
  theme?: "lime" | "green" | "red" | "cyan";
}) {
  const active = typeof value === "number" 
    ? value > 0 
    : (value && value !== "—" && value !== "0.00" && value !== "0" && value !== "0/0" && value !== "0 / 0" && value !== "0.0" && value !== "0s");

  let themeClasses = "border-border/20 bg-elevated/35 text-muted-foreground opacity-60";
  let abbrColor = "text-muted-foreground/80 bg-foreground/5";
  let valColor = "text-foreground/75";

  if (active) {
    if (theme === "lime") {
      themeClasses = "border-primary/30 bg-primary/5 shadow-[0_0_12px_rgba(195,244,0,0.08)]";
      abbrColor = "text-primary bg-primary/10";
      valColor = "text-primary font-bold";
    } else if (theme === "green") {
      themeClasses = "border-success/30 bg-success/5 shadow-[0_0_12px_rgba(34,197,94,0.08)]";
      abbrColor = "text-success bg-success/10";
      valColor = "text-success font-bold";
    } else if (theme === "red") {
      themeClasses = "border-destructive/30 bg-destructive/5 shadow-[0_0_12px_rgba(239,68,68,0.08)]";
      abbrColor = "text-destructive bg-destructive/10";
      valColor = "text-destructive font-bold";
    } else if (theme === "cyan") {
      themeClasses = "border-accent/30 bg-accent/5 shadow-[0_0_12px_rgba(0,209,255,0.08)]";
      abbrColor = "text-accent bg-accent/10";
      valColor = "text-accent font-bold";
    }
  }

  return (
    <div className={`flex items-center gap-2.5 border rounded-xl p-2.5 transition-all duration-500 hover:scale-[1.02] ${themeClasses}`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${abbrColor}`}>
        {labelAbbr}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className={`font-display text-base truncate mt-0.5 ${valColor}`}>{value}</div>
      </div>
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
          style={{ backgroundColor: team.color || "oklch(0.85 0.18 75)", color: "#0A1628" }}
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
