import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@/hooks/useApi";
import { Trophy, Award, Calendar, MapPin, Users } from "lucide-react";
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

  // Tournament Form Mode ("quick" or "detailed")
  const [tMode, setTMode] = useState<"quick" | "detailed">("quick");

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
      const isQuick = tMode === "quick";
      const id = await createTournament({
        name: tName.trim(),
        format: "T20",
        prizePool: isQuick ? "None" : (prizePool.trim() || undefined),
        startDate: isQuick ? new Date().toISOString().slice(0, 10) : (tDate || undefined),
        city: isQuick ? "Local Ground" : (city.trim() || undefined),
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
      <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl animate-scale-in">
        <DialogTitle className="font-display text-2xl mb-3 text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
          <Trophy className="h-6 w-6 text-muted-foreground" />
          Create or Join
        </DialogTitle>
        <Tabs defaultValue="tournament" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-elevated/40 backdrop-blur-md border border-border/40 rounded-xl p-1 mb-2">
            <TabsTrigger value="tournament" className="text-xs font-semibold">Tournament</TabsTrigger>
            <TabsTrigger value="join-team" className="text-xs font-semibold">Join Team</TabsTrigger>
            <TabsTrigger value="join-t" className="text-xs font-semibold">Join League</TabsTrigger>
          </TabsList>

          {/* Create Tournament */}
          <TabsContent value="tournament" className="mt-3 space-y-4">
            
            {/* Mode Selector */}
            <div className="flex bg-elevated/55 p-1 rounded-xl border border-border/20">
              <button
                type="button"
                onClick={() => setTMode("quick")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition duration-200 cursor-pointer ${
                  tMode === "quick"
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Quick Create (Name only)
              </button>
              <button
                type="button"
                onClick={() => setTMode("detailed")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition duration-200 cursor-pointer ${
                  tMode === "detailed"
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Detailed (Full info)
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div className="space-y-1 animate-fade-up" style={{ animationDelay: "60ms" }}>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-primary" /> Tournament Name
                </label>
                <Input
                  placeholder="e.g. Winter Cricket League"
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  disabled={loading}
                  className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                />
              </div>

              {/* Animated expand for detailed fields */}
              <div
                className="overflow-hidden"
                style={{
                  display: "grid",
                  gridTemplateRows: tMode === "detailed" ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div className="min-h-0">
                  <div
                    className="space-y-3 pt-1"
                    style={{
                      opacity: tMode === "detailed" ? 1 : 0,
                      transform: tMode === "detailed" ? "translateY(0)" : "translateY(-8px)",
                      transition: "opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.05s, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.05s",
                    }}
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Award className="h-3 w-3 text-primary" /> Prize Money
                      </label>
                      <Input
                        placeholder="e.g. ₹50,000 or ₹1 Lakh"
                        value={prizePool}
                        onChange={(e) => setPrizePool(e.target.value)}
                        disabled={loading}
                        className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" /> Start Date
                      </label>
                      <Input
                        type="date"
                        value={tDate}
                        onChange={(e) => setTDate(e.target.value)}
                        disabled={loading}
                        className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary" /> Location
                      </label>
                      <Input
                        placeholder="e.g. Mumbai, India"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={loading}
                        className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button variant="lime" className="w-full cursor-pointer mt-2 shadow-sm rounded-xl py-2 font-display" onClick={handleCreateTournament} disabled={loading}>
              {loading ? "Creating…" : "Create Tournament"}
            </Button>
          </TabsContent>

          {/* Join Team (Player) */}
          <TabsContent value="join-team" className="mt-3 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                <Users className="h-3 w-3 text-primary" /> Team Invite Code
              </label>
              <Input
                placeholder="e.g. MMV429"
                value={joinTeamCode}
                onChange={(e) => setJoinTeamCode(e.target.value)}
                disabled={loading}
                className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2 shadow-sm rounded-xl py-2 font-display" onClick={handleJoinTeam} disabled={loading}>
              {loading ? "Joining…" : "Join Team Squad"}
            </Button>
          </TabsContent>

          {/* Join Tournament (Captain) */}
          <TabsContent value="join-t" className="mt-3 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                <Trophy className="h-3 w-3 text-primary" /> Tournament Invite Code
              </label>
              <Input
                placeholder="e.g. TRN100"
                value={joinTCode}
                onChange={(e) => setJoinTCode(e.target.value)}
                disabled={loading}
                className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2 shadow-sm rounded-xl py-2 font-display" onClick={handleJoinTournament} disabled={loading}>
              {loading ? "Joining…" : "Join Tournament"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
