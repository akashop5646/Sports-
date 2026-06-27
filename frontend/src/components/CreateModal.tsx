import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateModal({ open, onOpenChange }: CreateModalProps) {
  const navigate = useNavigate();
  const createTournament = useApp((s) => s.createTournament);
  const createTeam = useApp((s) => s.createTeam);
  const joinTournament = useApp((s) => s.joinTournament);
  const joinTeam = useApp((s) => s.joinTeam);

  const [tName, setTName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [joinTCode, setJoinTCode] = useState("");
  const [joinTeamCode, setJoinTeamCode] = useState("");

  const handleCreateTournament = () => {
    const id = createTournament({ name: tName || "My Tournament" });
    toast.success("Tournament created");
    onOpenChange(false);
    setTName("");
    navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: id } });
  };

  const handleCreateTeam = () => {
    const id = createTeam({ name: teamName || "My Team" });
    toast.success("Team created");
    onOpenChange(false);
    setTeamName("");
    navigate({ to: "/teams/$teamId", params: { teamId: id } });
  };

  const handleJoinTournament = () => {
    const t = joinTournament(joinTCode);
    if (t) {
      toast.success(`Joined ${t.name}`);
      onOpenChange(false);
      setJoinTCode("");
      navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: t.id } });
    } else {
      toast.error("Code not found");
    }
  };

  const handleJoinTeam = () => {
    const t = joinTeam(joinTeamCode);
    if (t) {
      toast.success(`Joined ${t.name}`);
      onOpenChange(false);
      setJoinTeamCode("");
      navigate({ to: "/teams/$teamId", params: { teamId: t.id } });
    } else {
      toast.error("Code not found");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border rounded-3xl p-6 bg-elevated/95 backdrop-blur-xl">
        <DialogTitle className="font-display text-2xl mb-1">Create or Join</DialogTitle>
        <Tabs defaultValue="tournament" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-background border border-border/60">
            <TabsTrigger value="tournament">Tournament</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="join-t">Join T</TabsTrigger>
            <TabsTrigger value="join-team">Join Team</TabsTrigger>
          </TabsList>

          <TabsContent value="tournament" className="mt-4 space-y-3">
            <Input
              placeholder="Tournament name"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
            />
            <Button variant="lime" className="w-full" onClick={handleCreateTournament}>
              Create tournament
            </Button>
          </TabsContent>

          <TabsContent value="team" className="mt-4 space-y-3">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <Button variant="lime" className="w-full" onClick={handleCreateTeam}>
              Create team
            </Button>
          </TabsContent>

          <TabsContent value="join-t" className="mt-4 space-y-3">
            <Input
              placeholder="Tournament code"
              value={joinTCode}
              onChange={(e) => setJoinTCode(e.target.value)}
            />
            <Button variant="lime" className="w-full" onClick={handleJoinTournament}>
              Join tournament
            </Button>
          </TabsContent>

          <TabsContent value="join-team" className="mt-4 space-y-3">
            <Input
              placeholder="Team code"
              value={joinTeamCode}
              onChange={(e) => setJoinTeamCode(e.target.value)}
            />
            <Button variant="lime" className="w-full" onClick={handleJoinTeam}>
              Join team
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
