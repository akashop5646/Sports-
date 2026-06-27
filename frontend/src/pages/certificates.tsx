import { AppShell } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getCertificatesWithDetails } from "@/lib/api";
import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";

export default function Certificates() {
  useEffect(() => {
    document.title = "Certificates — Stadium Night";
  }, []);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates-detailed"],
    queryFn: () => getCertificatesWithDetails(),
  });

  return (
    <AppShell title="Certificates">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="h-8 w-8 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      ) : certs.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">
          No certificates issued yet. Win a tournament to earn one!
        </div>
      ) : (
        <div className="grid gap-3">
          {certs.map((c: any) => (
            <div
              key={c.id}
              className="gradient-card border border-border rounded-2xl p-5 shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl gradient-lime grid place-items-center shrink-0">
                  <Award className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-widest text-primary font-bold">
                    {c.type}
                  </div>
                  <div className="font-display text-xl mt-0.5 truncate">{c.recipientName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.tournamentName} · {c.issuedOn}
                  </div>
                </div>
              </div>
              <Button
                variant="hero"
                size="sm"
                className="w-full mt-3 cursor-pointer"
                onClick={() => toast.success("Certificate downloaded (demo)")}
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
