import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { useQuery, useQueryClient } from "@/hooks/useApi";
import { getMatch, getTeam } from "@/lib/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import * as React from "react";

interface TossModalProps {
  matchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTossCompleted: () => void;
}

export function TossModal({ matchId, open, onOpenChange, onTossCompleted }: TossModalProps) {
  const queryClient = useQueryClient();
  const setToss = useApp((s) => s.setToss);

  // Queries
  const { data: match } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch({ data: matchId }),
    enabled: open && !!matchId,
  });

  const { data: teamA } = useQuery({
    queryKey: ["team", match?.teamAId],
    queryFn: () => getTeam({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamB } = useQuery({
    queryKey: ["team", match?.teamBId],
    queryFn: () => getTeam({ data: match?.teamBId }),
    enabled: !!match,
  });

  const [phase, setPhase] = useState<"idle" | "spinning" | "result" | "skipped">("idle");
  const [result, setResult] = useState<"H" | "T">("H");
  const [winner, setWinner] = useState<string | null>(null);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (open) {
      setPhase("idle");
      setWinner(null);
    }
  }, [open]);

  if (!match) return null;

  const a = teamA || { id: match.teamAId, name: "Team A", shortName: "TMA" };
  const b = teamB || { id: match.teamBId, name: "Team B", shortName: "TMB" };

  const flip = () => {
    setPhase("spinning");
    setTimeout(() => {
      const winnerId = Math.random() > 0.5 ? a.id : b.id;
      setWinner(winnerId);
      setPhase("result");
    }, 1600);
  };

  const confirmDecision = async (decision: "bat" | "bowl") => {
    if (!winner) return;
    try {
      await setToss(matchId, winner, decision);
      const winnerName = winner === a.id ? a.name : b.name;
      toast.success(`${winnerName} chose to ${decision}`);
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament-matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament"] });
      onOpenChange(false);
      onTossCompleted();
    } catch (err) {
      toast.error("Failed to record toss decision.");
    }
  };

  const confirmDecisionDirectly = async (tossWinner: string, decision: "bat" | "bowl") => {
    try {
      await setToss(matchId, tossWinner, decision);
      const winnerName = tossWinner === a.id ? a.name : b.name;
      toast.success(`Toss skipped. Umpire chose ${winnerName} to bat first`);
      queryClient.invalidateQueries({ queryKey: ["match", matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament-matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament"] });
      onOpenChange(false);
      onTossCompleted();
    } catch (err) {
      toast.error("Failed to record toss decision.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border border-border/40 rounded-3xl p-6 bg-elevated/95 backdrop-blur-xl text-center shadow-2xl">
        <DialogTitle className="sr-only">Coin Toss</DialogTitle>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Toss Setup</div>
        <h1 className="font-display text-2xl mt-1 text-foreground">
          {a.shortName} vs {b.shortName}
        </h1>

        {phase !== "skipped" && (
          <div className="my-8 flex justify-center">
            <div className="gold-coin-container font-bold">
              <div
                className={`gold-coin ${phase === "spinning" ? "gold-coin-spinning" : ""}`}
                style={{
                  transform: phase === "result"
                    ? (winner === a.id ? "rotateY(1800deg)" : "rotateY(1980deg)")
                    : "rotateY(0deg)",
                  ...({ "--flip-target": winner === a.id ? "1800deg" : "1980deg" } as React.CSSProperties)
                }}
              >
                <div className="coin-face coin-face-front">
                  {a.shortName.slice(0, 4)}
                </div>
                <div className="coin-face coin-face-back">
                  {b.shortName.slice(0, 4)}
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "idle" && (
          <div className="space-y-3.5 w-full">
            <Button variant="lime" size="lg" className="w-full cursor-pointer shadow-glow font-bold" onClick={flip}>
              Flip Coin
            </Button>
            <button
              onClick={() => setPhase("skipped")}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline hover:no-underline transition w-full block py-1"
            >
              Skip Toss (Umpire Direct Decision)
            </button>
          </div>
        )}
        {phase === "spinning" && (
          <div className="text-muted-foreground animate-pulse py-2 font-semibold">Spinning the coin...</div>
        )}
        {phase === "result" && winner && (
          <div className="space-y-4 w-full animate-fade-up">
            <div className="font-display text-xl text-foreground font-semibold">
              {winner === a.id ? a.name : b.name} won the toss
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="lime" className="flex-1 cursor-pointer font-bold shadow-glow" onClick={() => confirmDecision("bat")}>
                Bat first
              </Button>
              <Button variant="hero" className="flex-1 cursor-pointer font-bold" onClick={() => confirmDecision("bowl")}>
                Bowl first
              </Button>
            </div>
          </div>
        )}
        {phase === "skipped" && (
          <div className="space-y-4 w-full animate-fade-up mt-6">
            <div className="text-xs text-muted-foreground leading-normal">
              Toss skipped. Umpire / Organizer will decide which team bats first:
            </div>
            <div className="flex flex-col gap-2.5 w-full">
              <Button
                variant="lime"
                className="w-full cursor-pointer font-bold shadow-glow py-3"
                onClick={() => confirmDecisionDirectly(a.id, "bat")}
              >
                🏏 {a.name} to Bat First
              </Button>
              <Button
                variant="hero"
                className="w-full cursor-pointer font-bold py-3"
                onClick={() => confirmDecisionDirectly(b.id, "bat")}
              >
                🏏 {b.name} to Bat First
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full cursor-pointer border-border/40 text-muted-foreground mt-2"
                onClick={() => setPhase("idle")}
              >
                Go Back to Coin Flip
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
