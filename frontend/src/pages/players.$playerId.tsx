import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, StatPill } from "@/components/AppShell";
import { findPlayer, findTeam, DB } from "@/lib/mockdb";

export const Route = createFileRoute("/players/$playerId")({
  head: ({ params }) => ({ meta: [{ title: `Player ${params.playerId} — Stadium Night` }] }),
  component: PlayerDetail,
});

function PlayerDetail() {
  const { playerId } = Route.useParams();
  const p = findPlayer(playerId);
  if (!p) throw notFound();
  const team = findTeam(p.teamId)!;
  const avg =
    p.stats.innings - p.stats.notOuts > 0
      ? (p.stats.runs / (p.stats.innings - p.stats.notOuts)).toFixed(2)
      : "—";
  const sr = p.stats.ballsFaced > 0 ? ((p.stats.runs / p.stats.ballsFaced) * 100).toFixed(2) : "—";
  const econ =
    p.stats.ballsBowled > 0 ? (p.stats.runsConceded / (p.stats.ballsBowled / 6)).toFixed(2) : "—";
  const certs = DB.certificates.filter((c) => c.playerId === playerId);

  return (
    <AppShell title="Player">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/15 grid place-items-center font-display text-2xl text-primary">
            {p.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl truncate">{p.name}</h1>
            <Link
              to="/teams/$teamId"
              params={{ teamId: team.id }}
              className="text-xs text-muted-foreground"
            >
              {team.name} · #{p.jersey}
            </Link>
            <div className="text-xs text-muted-foreground mt-0.5">
              {p.role} · {p.battingStyle} · {p.bowlingStyle}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <StatPill label="Matches" value={p.stats.matches} />
          <StatPill label="Runs" value={p.stats.runs} accent />
          <StatPill label="Wkts" value={p.stats.wickets} />
          <StatPill label="HS" value={p.stats.highScore} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatPill label="Avg" value={avg} />
          <StatPill label="SR" value={sr} />
          <StatPill label="Econ" value={econ} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <StatPill label="50s" value={p.stats.fifties} />
          <StatPill label="100s" value={p.stats.hundreds} />
          <StatPill label="4s" value={p.stats.fours} />
          <StatPill label="6s" value={p.stats.sixes} />
        </div>
      </div>

      {p.achievements.length > 0 && (
        <>
          <h2 className="font-display text-2xl mt-6 mb-3">Achievements</h2>
          <div className="flex flex-wrap gap-2">
            {p.achievements.map((a) => (
              <span
                key={a}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/30"
              >
                {a}
              </span>
            ))}
          </div>
        </>
      )}

      {certs.length > 0 && (
        <>
          <h2 className="font-display text-2xl mt-6 mb-3">Certificates</h2>
          <div className="grid gap-2">
            {certs.map((c) => (
              <div
                key={c.id}
                className="bg-elevated border border-border rounded-xl p-3 flex items-center justify-between"
              >
                <span className="font-medium">{c.type}</span>
                <span className="text-xs text-muted-foreground">{c.issuedOn}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
