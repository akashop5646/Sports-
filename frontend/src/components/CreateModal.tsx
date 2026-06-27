import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@/hooks/useApi";
import * as React from "react";

interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateModal({ open, onOpenChange }: CreateModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createTournament = useApp((s) => s.createTournament);
  const joinTournament = useApp((s) => s.joinTournament);
  const joinTeam = useApp((s) => s.joinTeam);

  const [tName, setTName] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [tDate, setTDate] = useState(new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState("");
  const [joinTCode, setJoinTCode] = useState("");
  const [joinTeamCode, setJoinTeamCode] = useState("");

  const [loading, setLoading] = useState(false);

  const handleCreateTournament = async () => {
    if (!tName.trim()) {
      toast.error("Please enter a tournament name.");
      return;
    }
    setLoading(true);
    try {
      const id = await createTournament({
        name: tName.trim(),
        format: "T20",
        prizePool: prizePool.trim() || undefined,
        startDate: tDate || undefined,
        city: city.trim() || undefined,
      });
      toast.success("Tournament created successfully!");
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      onOpenChange(false);
      setTName("");
      setPrizePool("");
      setTDate(new Date().toISOString().slice(0, 10));
      setCity("");
      navigate(`/tournaments/${id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create tournament.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    if (!joinTCode.trim()) {
      toast.error("Please enter an invite code.");
      return;
    }
    setLoading(true);
    try {
      const t = await joinTournament(joinTCode.trim());
      toast.success(`Successfully joined tournament ${t.name}!`);
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament", t.id] });
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", t.id] });
      onOpenChange(false);
      setJoinTCode("");
      navigate(`/tournaments/${t.id}`);
    } catch (e: any) {
      toast.error(e.message || "Invalid tournament code.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinTeamCode.trim()) {
      toast.error("Please enter a team code.");
      return;
    }
    setLoading(true);
    try {
      const team = await joinTeam(joinTeamCode.trim());
      toast.success(`Successfully joined squad of ${team.name}!`);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team", team.id] });
      queryClient.invalidateQueries({ queryKey: ["team-players", team.id] });
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", team.tournamentId] });
      onOpenChange(false);
      setJoinTeamCode("");
      navigate(`/teams/${team.id}`);
    } catch (e: any) {
      toast.error(e.message || "Invalid team invite code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-glow">
        <DialogTitle className="font-display text-2xl mb-2">Create or Join</DialogTitle>
        <Tabs defaultValue="tournament" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-elevated/40 backdrop-blur-md border border-border/40 rounded-xl p-1">
            <TabsTrigger value="tournament" className="text-xs">Tournament</TabsTrigger>
            <TabsTrigger value="join-team" className="text-xs">Join team</TabsTrigger>
            <TabsTrigger value="join-t" className="text-xs">Join Tournament</TabsTrigger>
          </TabsList>

          {/* Create Tournament */}
          <TabsContent value="tournament" className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tournament Name</label>
              <Input
                placeholder="Tournament name"
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Prize Money</label>
              <Input
                placeholder="Prize pool (e.g. $1,000 or 50,000 INR)"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tournament Date</label>
              <Input
                type="date"
                value={tDate}
                onChange={(e) => setTDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Location</label>
              <Input
                placeholder="Tournament location/city (e.g. Mumbai)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2" onClick={handleCreateTournament} disabled={loading}>
              {loading ? "Creating…" : "Create tournament"}
            </Button>
          </TabsContent>

          {/* Join Team (Player) */}
          <TabsContent value="join-team" className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Team Invite Code</label>
              <Input
                placeholder="Team invite code (e.g. MMV429)"
                value={joinTeamCode}
                onChange={(e) => setJoinTeamCode(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2" onClick={handleJoinTeam} disabled={loading}>
              {loading ? "Joining…" : "Join team squad"}
            </Button>
          </TabsContent>

          {/* Join Tournament (Captain) */}
          <TabsContent value="join-t" className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Tournament Invite Code</label>
              <Input
                placeholder="Tournament invite code (e.g. TRN1000)"
                value={joinTCode}
                onChange={(e) => setJoinTCode(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2" onClick={handleJoinTournament} disabled={loading}>
              {loading ? "Joining…" : "Join tournament"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
