import { Link, useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getMatch, getTeam, getTeamPlayers } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { TossModal } from "@/components/TossModal";

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [tossOpen, setTossOpen] = useState(false);

  // Match Query
  const { data: match, isLoading: loadingMatch } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch({ data: matchId }),
  });

  // Team Queries (enabled when match is fetched)
  const { data: teamA, isLoading: loadingTeamA } = useQuery({
    queryKey: ["team", match?.teamAId],
    queryFn: () => getTeam({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamB, isLoading: loadingTeamB } = useQuery({
    queryKey: ["team", match?.teamBId],
    queryFn: () => getTeam({ data: match?.teamBId }),
    enabled: !!match,
  });

  // Players Queries (for rosters of both teams)
  const { data: teamAPlayers = [] } = useQuery({
    queryKey: ["team-players", match?.teamAId],
    queryFn: () => getTeamPlayers({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamBPlayers = [] } = useQuery({
    queryKey: ["team-players", match?.teamBId],
    queryFn: () => getTeamPlayers({ data: match?.teamBId }),
    enabled: !!match,
  });

  const a = teamA || (match ? { id: match.teamAId, name: "Team A", shortName: "TMA", color: "#666" } : null);
  const b = teamB || (match ? { id: match.teamBId, name: "Team B", shortName: "TMB", color: "#666" } : null);

  useEffect(() => {
    if (match && a && b) {
      document.title = `${a.shortName} vs ${b.shortName} — Stadium Night`;
    } else {
      document.title = "Match Details — Stadium Night";
    }
  }, [match, a, b]);

  if (loadingMatch || loadingTeamA || loadingTeamB) {
    return (
      <AppShell title="Match">
        <div className="flex justify-center items-center py-24">
          <div className="h-10 w-10 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!match || !a || !b) {
    return (
      <AppShell title="Match Not Found">
        <div className="text-center py-24">
          <h2 className="font-display text-2xl text-destructive">Match Not Found</h2>
          <p className="text-muted-foreground text-sm mt-2">The match you are looking for does not exist.</p>
          <Link to="/matches" className="inline-block mt-4 text-primary hover:underline">Back to Matches</Link>
        </div>
      </AppShell>
    );
  }

  const matchPlayers = [...teamAPlayers, ...teamBPlayers];
  const findMatchPlayer = (pid: string) => matchPlayers.find((p: any) => p.id === pid);

  const getTeamName = (tid: string) => {
    if (tid === a.id) return a.name;
    if (tid === b.id) return b.name;
    return "Unknown Team";
  };

  const getTeamColor = (tid: string) => {
    if (tid === a.id) return a.color;
    if (tid === b.id) return b.color;
    return "#666";
  };

  const getTeamShort = (tid: string) => {
    if (tid === a.id) return a.shortName;
    if (tid === b.id) return b.shortName;
    return "UNK";
  };

  return (
    <AppShell title="Match">
      <div className="glass-card border border-border/40 rounded-2xl p-5 shadow-card">
        <div className="text-xs text-muted-foreground">
          {match.venue} · {match.date}
        </div>
        {match.innings && match.innings.map((inn: any, i: number) => {
          const tColor = getTeamColor(inn.battingTeamId);
          const tShort = getTeamShort(inn.battingTeamId);
          return (
            <div key={i} className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg grid place-items-center font-display font-bold text-sm"
                  style={{ backgroundColor: tColor || "oklch(0.85 0.18 75)", color: "#0A1628" }}
                >
                  {tShort.slice(0, 2)}
                </div>
                <div>
                  <div className="font-display text-lg">{tShort}</div>
                  <div className="text-xs text-muted-foreground">Innings {i + 1}</div>
                </div>
              </div>
              <div className="font-display text-3xl">
                {inn.runs}/{inn.wickets}
                <span className="text-sm text-muted-foreground ml-2">({inn.overs})</span>
              </div>
            </div>
          );
        })}
        {(!match.innings || match.innings.length === 0) && (
          <div className="flex items-center justify-between mt-3">
            <div className="font-display text-2xl">
              {a.shortName} vs {b.shortName}
            </div>
            <span className="text-xs text-accent uppercase font-bold tracking-wider">Upcoming</span>
          </div>
        )}
        <div className="text-sm text-primary mt-3 font-medium">{match.resultText}</div>
        {match.motmId && (
          <div className="text-xs text-muted-foreground mt-1">
            Player of the Match: {findMatchPlayer(match.motmId)?.name || "N/A"}
          </div>
        )}

        {match.status === "upcoming" && (
          <Button
            variant="lime"
            size="sm"
            className="w-full mt-4 cursor-pointer"
            onClick={() => setTossOpen(true)}
          >
            Start Match — Toss
          </Button>
        )}
        {match.status === "live" && (
          <Button
            variant="lime"
            size="sm"
            className="w-full mt-4 cursor-pointer"
            onClick={() => navigate(`/matches/${matchId}/score`)}
          >
            Open Scoring
          </Button>
        )}
      </div>

      <TossModal
        matchId={matchId!}
        open={tossOpen}
        onOpenChange={setTossOpen}
        onTossCompleted={() => {
          navigate(`/matches/${matchId}/score`);
        }}
      />

      {match.innings && match.innings.length > 0 && (
        <Tabs defaultValue="scorecard" className="mt-6">
          <TabsList className="grid grid-cols-3 w-full bg-elevated/40 backdrop-blur-md">
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="bowling">Bowling</TabsTrigger>
            <TabsTrigger value="commentary">Commentary</TabsTrigger>
          </TabsList>
          <TabsContent value="scorecard" className="mt-4 grid gap-4">
            {match.innings.map((inn: any, i: number) => (
              <div key={i} className="glass-card border border-border/40 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-white/5 font-semibold">
                  {getTeamName(inn.battingTeamId)} — {inn.runs}/{inn.wickets} ({inn.overs})
                </div>
                {inn.batters && inn.batters
                  .filter((bat: any) => bat.balls > 0)
                  .slice(0, 11)
                  .map((bat: any) => (
                    <Link
                      key={bat.playerId}
                      to={`/players/${bat.playerId}`}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-xs items-center border-b border-border/40 last:border-0 hover:bg-white/5 transition"
                    >
                      <span className="truncate">
                        {findMatchPlayer(bat.playerId)?.name || "Batter"}
                        <span className="text-muted-foreground"> {bat.dismissal ?? "not out"}</span>
                      </span>
                      <span className="font-bold">{bat.runs}</span>
                      <span className="text-muted-foreground">{bat.balls}b</span>
                      <span className="text-muted-foreground">{bat.fours}×4</span>
                      <span className="text-muted-foreground">{bat.sixes}×6</span>
                    </Link>
                  ))}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="bowling" className="mt-4 grid gap-4">
            {match.innings.map((inn: any, i: number) => (
              <div key={i} className="glass-card border border-border/40 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-white/5 font-semibold">
                  Bowling — {getTeamName(inn.bowlingTeamId)}
                </div>
                {inn.bowlers && inn.bowlers.map((bw: any) => (
                  <div
                    key={bw.playerId}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-xs border-b border-border/40 last:border-0"
                  >
                    <span className="truncate">{findMatchPlayer(bw.playerId)?.name || "Bowler"}</span>
                    <span>{bw.overs}</span>
                    <span>{bw.runs}r</span>
                    <span className="font-bold">{bw.wickets}w</span>
                    <span className="text-muted-foreground">{bw.economy}</span>
                  </div>
                ))}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="commentary" className="mt-4 grid gap-2">
            {match.commentary && match.commentary.map((comm: any, i: number) => (
              <div
                key={i}
                className={`border rounded-xl p-3 ${comm.wicket ? "bg-destructive/10 border-destructive/40" : "glass-card border-border/40"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{comm.over}</span>
                  {comm.runs !== undefined && (
                    <span className="text-xs font-bold text-primary">{comm.runs} runs</span>
                  )}
                </div>
                <div className="text-sm mt-1">{comm.text}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
