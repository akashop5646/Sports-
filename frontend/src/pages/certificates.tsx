import { AppShell } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getCertificatesWithDetails } from "@/lib/api";
import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";

export default function Certificates() {
  useEffect(() => {
    document.title = "Certificates — CreaseLive";
  }, []);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates-detailed"],
    queryFn: () => getCertificatesWithDetails(),
  });

  const printCertificate = (c: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocker prevented opening the certificate.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Certificate - ${c.recipientName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Montserrat:wght@400;600&family=Pinyon+Script&display=swap" rel="stylesheet">
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #0A1628;
              color: #FFFFFF;
              font-family: 'Montserrat', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .cert-container {
              width: 800px;
              height: 550px;
              padding: 40px;
              border: 10px double #A3E635;
              background: linear-gradient(135deg, #0f2038 0%, #050b14 100%);
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
              position: relative;
              text-align: center;
              box-sizing: border-box;
            }
            .cert-logo {
              font-family: 'Cinzel', serif;
              font-size: 20px;
              color: #A3E635;
              letter-spacing: 4px;
              margin-top: 10px;
            }
            .cert-title {
              font-family: 'Cinzel', serif;
              font-size: 38px;
              color: #FFFFFF;
              margin-top: 20px;
              letter-spacing: 2px;
            }
            .cert-subtitle {
              font-size: 14px;
              color: #94A3B8;
              text-transform: uppercase;
              letter-spacing: 5px;
              margin-top: 5px;
            }
            .presented-to {
              font-size: 16px;
              color: #94A3B8;
              margin-top: 25px;
              font-style: italic;
            }
            .recipient-name {
              font-family: 'Pinyon Script', cursive;
              font-size: 56px;
              color: #A3E635;
              margin-top: 10px;
              margin-bottom: 10px;
            }
            .cert-award {
              font-size: 22px;
              font-weight: 600;
              color: #FFFFFF;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-top: 10px;
            }
            .cert-tournament {
              font-size: 14px;
              color: #94A3B8;
              margin-top: 10px;
            }
            .cert-date {
              font-size: 12px;
              color: #64748B;
              margin-top: 15px;
            }
            .cert-footer {
              margin-top: 40px;
              display: flex;
              justify-content: space-around;
              align-items: center;
            }
            .signature-line {
              width: 150px;
              border-top: 1px solid #A3E635;
              padding-top: 5px;
              font-size: 10px;
              color: #94A3B8;
            }
            @media print {
              body {
                background-color: #FFFFFF;
                color: #000000;
              }
              .cert-container {
                border: 10px double #000000;
                background: #FFFFFF;
                box-shadow: none;
                color: #000000;
              }
              .cert-logo, .recipient-name, .signature-line {
                color: #000000;
              }
              .cert-title, .cert-award {
                color: #000000;
              }
              .cert-subtitle, .presented-to, .cert-tournament, .cert-date {
                color: #555555;
              }
            }
          </style>
        </head>
        <body>
          <div class="cert-container">
            <div class="cert-logo">CREASELIVE</div>
            <div class="cert-subtitle">Cricket League Association</div>
            <div class="cert-title">CERTIFICATE OF ACHIEVEMENT</div>
            <div class="presented-to">This is proudly presented to</div>
            <div class="recipient-name">${c.recipientName}</div>
            <div class="cert-award">${c.type}</div>
            <div class="cert-tournament">for outstanding performance in ${c.tournamentName}</div>
            <div class="cert-date">Issued on ${c.issuedOn}</div>
            <div class="cert-footer">
              <div class="signature-line">League President</div>
              <div class="signature-line">Tournament Director</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1000);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

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
                onClick={() => printCertificate(c)}
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
