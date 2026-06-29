import { Link, useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getMatch, getTeam, getTeamPlayers, getTournament, deleteMatch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { TossModal } from "@/components/TossModal";
import { useApp } from "@/lib/store";
import { CricketLoading, useLoadingState } from "@/components/CricketLoading";
import { toast } from "sonner";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [tossOpen, setTossOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);

  const user = useApp((s) => s.user);

  const queryClient = useQueryClient();

  const cancelMatchMutation = useMutation({
    mutationFn: () => deleteMatch({ data: matchId }),
    onSuccess: () => {
      toast.success("Match cancelled and removed.");
      queryClient.invalidateQueries({ queryKey: ["tournament-matches", match?.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament", match?.tournamentId] });
      navigate(`/tournaments/${match?.tournamentId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel match.");
    },
  });

  // Match Query
  const { data: match, isLoading: loadingMatch } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch({ data: matchId }),
  });

  // Tournament Query
  const { data: tournament, isLoading: loadingTournament } = useQuery({
    queryKey: ["tournament", match?.tournamentId],
    queryFn: () => getTournament({ data: match?.tournamentId }),
    enabled: !!match,
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
  const { data: teamAPlayers = [], isLoading: loadingPlayersA } = useQuery({
    queryKey: ["team-players", match?.teamAId],
    queryFn: () => getTeamPlayers({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamBPlayers = [], isLoading: loadingPlayersB } = useQuery({
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

  const isLoading = useLoadingState(loadingMatch || loadingTeamA || loadingTeamB || loadingPlayersA || loadingPlayersB || loadingTournament);

  if (isLoading) {
    return (
      <AppShell title="Match">
        <CricketLoading />
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

        {match.umpireIds && match.umpireIds.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2 border-t border-border/10 pt-2 flex items-center justify-between">
            <span>Umpire(s):</span>
            <span className="font-semibold text-primary">
              {match.umpireIds.map((uid: string) => findMatchPlayer(uid)?.name).filter(Boolean).join(", ") || "Assigned"}
            </span>
          </div>
        )}

        {(() => {
          const isOrganizer = user && tournament && (tournament.organizerId === user.id || tournament.organizer === user.name);
          const matchUmpires = match.umpireIds || [];
          const isUmpire = user?.playerId && matchUmpires.includes(user.playerId);
          const hasUmpires = matchUmpires.length > 0;
          const canScore = hasUmpires ? (isUmpire || isOrganizer) : isOrganizer;

          if (canScore) {
            return (
              <>
                {match.status === "upcoming" && (
                  <Button
                    variant="lime"
                    size="sm"
                    className="w-full mt-4 cursor-pointer shadow-glow font-bold animate-fade-up"
                    onClick={() => setTossOpen(true)}
                  >
                    Start Match — Toss
                  </Button>
                )}
                {match.status === "live" && (
                  <Button
                    variant="lime"
                    size="sm"
                    className="w-full mt-4 cursor-pointer shadow-glow font-bold animate-fade-up"
                    onClick={() => navigate(`/matches/${matchId}/score`)}
                  >
                    Open Scoring
                  </Button>
                )}
              </>
            );
          } else {
            return (
              <div className="mt-4 text-xs text-muted-foreground text-center bg-white/5 border border-border/20 p-2.5 rounded-xl animate-fade-up">
                {hasUmpires 
                  ? "This match is managed by the assigned Umpire(s)." 
                  : "This match is managed by the Tournament Organizer."}
              </div>
            );
          }
        })()}

        {(() => {
          const isOrganizer = user && tournament && (tournament.organizerId === user.id || tournament.organizer === user.name);
          if (isOrganizer && match.status !== "completed") {
            return (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelMatchMutation.isPending}
                className="w-full mt-2.5 cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/10 rounded-xl transition font-semibold animate-fade-up"
                onClick={() => setIsCancelAlertOpen(true)}
              >
                {cancelMatchMutation.isPending ? "Cancelling..." : "Cancel & Delete Match"}
              </Button>
            );
          }
          return null;
        })()}
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
          
          <TabsContent value="scorecard" className="mt-4 grid gap-4 animate-fade-up">
            {match.innings.map((inn: any, i: number) => (
              <div key={i} className="glass-card border border-border/40 rounded-2xl overflow-hidden shadow-card">
                <div className="px-4 py-3 text-xs uppercase tracking-widest text-primary border-b border-border/40 bg-white/5 font-bold flex justify-between items-center">
                  <span>{getTeamName(inn.battingTeamId)} Innings</span>
                  <span className="font-mono text-foreground">{inn.runs}/{inn.wickets} ({inn.overs} ov)</span>
                </div>
                
                {/* Header Row */}
                <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-[9px] uppercase tracking-wider text-muted-foreground/60 border-b border-border/20 font-bold bg-black/20">
                  <span>Batter</span>
                  <span className="text-right">R</span>
                  <span className="text-right">B</span>
                  <span className="text-right">4s</span>
                  <span className="text-right">6s</span>
                  <span className="text-right">SR</span>
                </div>

                {inn.batters && inn.batters
                  .filter((bat: any) => bat.balls > 0)
                  .slice(0, 11)
                  .map((bat: any) => {
                    const sr = bat.balls > 0 ? ((bat.runs / bat.balls) * 100).toFixed(1) : "0.0";
                    return (
                      <Link
                        key={bat.playerId}
                        to={`/players/${bat.playerId}`}
                        className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-3 text-xs items-center border-b border-border/40 last:border-0 hover:bg-white/5 transition"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {findMatchPlayer(bat.playerId)?.name || "Batter"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                            {bat.dismissal || "not out"}
                          </span>
                        </div>
                        <span className="font-bold text-right text-foreground">{bat.runs}</span>
                        <span className="text-muted-foreground text-right">{bat.balls}</span>
                        <span className="text-muted-foreground text-right">{bat.fours}</span>
                        <span className="text-muted-foreground text-right">{bat.sixes}</span>
                        <span className="text-muted-foreground text-right font-mono text-[11px]">{sr}</span>
                      </Link>
                    );
                  })}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="bowling" className="mt-4 grid gap-4 animate-fade-up">
            {match.innings.map((inn: any, i: number) => (
              <div key={i} className="glass-card border border-border/40 rounded-2xl overflow-hidden shadow-card">
                <div className="px-4 py-3 text-xs uppercase tracking-widest text-primary border-b border-border/40 bg-white/5 font-bold">
                  Bowling — {getTeamName(inn.bowlingTeamId)}
                </div>

                {/* Header Row */}
                <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-[9px] uppercase tracking-wider text-muted-foreground/60 border-b border-border/20 font-bold bg-black/20">
                  <span>Bowler</span>
                  <span className="text-right">O</span>
                  <span className="text-right">R</span>
                  <span className="text-right">W</span>
                  <span className="text-right">Econ</span>
                </div>

                {inn.bowlers && inn.bowlers.map((bw: any) => (
                  <div
                    key={bw.playerId}
                    className="grid grid-cols-[3fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-3 text-xs border-b border-border/40 last:border-0 items-center"
                  >
                    <span className="font-semibold text-foreground truncate">
                      {findMatchPlayer(bw.playerId)?.name || "Bowler"}
                    </span>
                    <span className="text-muted-foreground text-right">{bw.overs}</span>
                    <span className="text-muted-foreground text-right">{bw.runs}</span>
                    <span className="font-bold text-right text-foreground">{bw.wickets}</span>
                    <span className="text-muted-foreground text-right font-mono text-[11px]">{bw.economy}</span>
                  </div>
                ))}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="commentary" className="mt-4 grid gap-3 animate-fade-up">
            {match.commentary && match.commentary.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No commentary available yet.</div>
            ) : (
              match.commentary.map((comm: any, i: number) => {
                const isOut = comm.wicket;
                const isFour = comm.text && comm.text.startsWith("FOUR");
                const isSix = comm.text && comm.text.startsWith("SIX");
                const isExtra = comm.text && (comm.text.startsWith("Wide") || comm.text.startsWith("No ball"));

                let tagBg = "bg-white/5 border-border/20 text-muted-foreground";
                let tagText = "RUNS";
                if (isOut) {
                  tagBg = "bg-destructive/10 border-destructive/30 text-destructive";
                  tagText = "OUT";
                } else if (isSix) {
                  tagBg = "bg-primary/10 border-primary/30 text-primary";
                  tagText = "SIX";
                } else if (isFour) {
                  tagBg = "bg-accent/10 border-accent/30 text-accent";
                  tagText = "FOUR";
                } else if (isExtra) {
                  tagBg = "bg-yellow-500/10 border-yellow-500/30 text-yellow-500";
                  tagText = "EXTRA";
                } else if (comm.runs === 0) {
                  tagBg = "bg-white/5 border-border/10 text-muted-foreground/60";
                  tagText = "DOT";
                }

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-4 p-4 border rounded-2xl transition-all duration-300 ${
                      isOut 
                        ? "bg-destructive/5 border-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]" 
                        : "glass-card border-border/40 hover:border-border/60"
                    }`}
                  >
                    {/* Over Badge */}
                    <div className="h-10 w-10 shrink-0 rounded-full border border-border/40 bg-elevated/80 flex items-center justify-center font-mono text-xs font-bold text-foreground shadow-sm">
                      {comm.over}
                    </div>

                    {/* Content */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tagBg}`}>
                          {tagText}
                        </span>
                        {comm.runs !== undefined && !isExtra && !isOut && (
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {comm.runs} {comm.runs === 1 ? "run" : "runs"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed font-semibold">
                        {comm.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Cancel Match Confirmation Popup UI */}
      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent className="glass-card border border-destructive/30 rounded-2xl shadow-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Cancel & Delete Match
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-normal">
              Are you sure you want to cancel and delete this match? This will remove all scoring history and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl border border-border/40 bg-elevated/45 hover:bg-elevated text-foreground text-xs font-semibold py-2">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMatchMutation.isPending}
              onClick={() => cancelMatchMutation.mutate()}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs py-2"
            >
              {cancelMatchMutation.isPending ? "Cancelling..." : "Yes, Cancel Match"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
