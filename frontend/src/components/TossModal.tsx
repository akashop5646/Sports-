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

  const [phase, setPhase] = useState<"idle" | "spinning" | "result">("idle");
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
      const r = Math.random() > 0.5 ? "H" : "T";
      setResult(r);
      setWinner(r === "H" ? a.id : b.id);
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
      onOpenChange(false);
      onTossCompleted();
    } catch (err) {
      toast.error("Failed to record toss decision.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border border-border rounded-3xl p-6 bg-elevated/95 backdrop-blur-xl text-center">
        <DialogTitle className="sr-only">Coin Toss</DialogTitle>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Toss</div>
        <h1 className="font-display text-2xl mt-1">
          {a.shortName} vs {b.shortName}
        </h1>

        <div className="my-8 flex justify-center">
          <div
            className="h-32 w-32 rounded-full gradient-lime shadow-glow grid place-items-center font-display text-5xl text-primary-foreground transition-transform"
            style={{
              transform: phase === "spinning" ? "rotateY(1800deg) rotateX(720deg)" : "rotateY(0)",
              transitionDuration: phase === "spinning" ? "1600ms" : "0ms",
              transformStyle: "preserve-3d",
            }}
          >
            {phase === "result" ? result : "?"}
          </div>
        </div>

        {phase === "idle" && (
          <Button variant="lime" size="lg" className="w-full cursor-pointer" onClick={flip}>
            Flip the coin
          </Button>
        )}
        {phase === "spinning" && (
          <div className="text-muted-foreground animate-pulse py-2">Spinning…</div>
        )}
        {phase === "result" && winner && (
          <div className="space-y-4 w-full">
            <div className="font-display text-xl">
              {(winner === a.id ? a.name : b.name)} won the toss
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="lime" className="flex-1 cursor-pointer" onClick={() => confirmDecision("bat")}>
                Bat first
              </Button>
              <Button variant="hero" className="flex-1 cursor-pointer" onClick={() => confirmDecision("bowl")}>
                Bowl first
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
