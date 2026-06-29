import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Trophy, Users, BarChart3, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";

const slides = [
  {
    icon: Trophy,
    title: "Run tournaments end-to-end",
    body: "Fixtures, points table, awards and certificates — all in one place.",
  },
  {
    icon: Zap,
    title: "Live ball-by-ball scoring",
    body: "Tap to score. Stats, commentary and run-rate update in real-time.",
  },
  {
    icon: Users,
    title: "Teams & squads",
    body: "Share a code, approve players, manage your XI with one tap.",
  },
  {
    icon: BarChart3,
    title: "Career-grade analytics",
    body: "Orange cap, purple cap, MVPs, certificates — owned by every player.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const complete = useApp((s) => s.completeOnboarding);
  const S = slides[step];
  const Icon = S.icon;
  const last = step === slides.length - 1;

  useEffect(() => {
    document.title = "Welcome — Stadium Night";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed progress dots at the top */}
      <div className="flex gap-1.5 justify-center mt-12 mb-4">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-primary" : "w-4 bg-muted"}`}
          />
        ))}
      </div>

      {/* Animated slide content */}
      <div 
        key={step} 
        className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-come"
      >
        <div className="h-32 w-32 rounded-3xl gradient-lime grid place-items-center shadow-glow mb-8 animate-scale-in">
          <Icon className="h-14 w-14 text-primary-foreground" />
        </div>
        <h1 className="font-display text-4xl text-balance">{S.title}</h1>
        <p className="text-muted-foreground mt-3 max-w-xs text-balance">{S.body}</p>
      </div>

      <div className="p-6 flex flex-col gap-2 max-w-md w-full mx-auto pb-10">
        <Button
          variant="lime"
          size="lg"
          className="cursor-pointer"
          onClick={() => {
            if (last) {
              complete();
              navigate("/login");
            } else setStep(step + 1);
          }}
        >
          {last ? "Get started" : "Continue"} <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          className="cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => {
            complete();
            navigate("/login");
          }}
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
