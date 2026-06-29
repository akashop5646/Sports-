import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Trophy, Users, Bell, User2, Plus, ChevronLeft, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AuthModal } from "@/components/AuthModal";
import { CreateModal } from "@/components/CreateModal";
import { NotificationsModal } from "@/components/NotificationsModal";
import { AddFriendModal } from "@/components/AddFriendModal";
import { getCurrentUser } from "@/lib/auth";
import { useQuery } from "@/hooks/useApi";
import { getNotifications, updatePlayer } from "@/lib/api";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { toast } from "sonner";

export function BackgroundShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const vertexShaderSource = `
      attribute vec2 position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = position * 0.5 + 0.5;
        v_texCoord.y = 1.0 - v_texCoord.y;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;

      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 a0 = x - floor(x + 0.5);
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = v_texCoord;
        float n1 = snoise(uv * 3.0 + u_time * 0.1);
        float n2 = snoise(uv * 5.0 - u_time * 0.15);
        vec3 color1 = vec3(0.05, 0.05, 0.07);
        vec3 color2 = vec3(0.76, 0.95, 0.0); 
        vec3 color3 = vec3(0.0, 0.5, 0.8);
        float mixFactor = smoothstep(0.1, 0.9, n1 * 0.5 + 0.5);
        vec3 finalColor = mix(color1, color2 * 0.04, mixFactor);
        float pulse = smoothstep(0.4, 0.6, n2 * 0.5 + 0.5);
        finalColor = mix(finalColor, color3 * 0.02, pulse);
        float d = distance(uv, vec2(0.5));
        finalColor *= smoothstep(1.2, 0.4, d);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    function createShader(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl!.getShaderInfoLog(shader));
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const program = gl.createProgram();
    if (!program) return;

    const vs = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    let animationId: number;

    function resize() {
      if (!canvas || !gl) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener("resize", resize);
    resize();

    function render(time: number) {
      if (!gl) return;
      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform2f(resolutionLocation, canvas!.width, canvas!.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationId = requestAnimationFrame(render);
    }
    
    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
    />
  );
}

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { label: "Create", icon: Plus, primary: true },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/profile", label: "Profile", icon: User2 },
];

export function AppShell({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const user = useApp((s) => s.user);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    enabled: !!user,
  });
  const unread = notifications.filter((n: any) => !n.read).length;

  const authModalOpen = useApp((s) => s.authModalOpen);
  const setAuthModalOpen = useApp((s) => s.setAuthModalOpen);

  const createModalOpen = useApp((s) => s.createModalOpen);
  const setCreateModalOpen = useApp((s) => s.setCreateModalOpen);

  const notificationsModalOpen = useApp((s) => s.notificationsModalOpen);
  const setNotificationsModalOpen = useApp((s) => s.setNotificationsModalOpen);

  const setUser = useApp((s) => s.setUser);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);

  // Profile Onboarding Wizard State
  const [wizardStep, setWizardStep] = useState(0);
  const [wizAge, setWizAge] = useState("");
  const [wizJersey, setWizJersey] = useState("");
  const [wizRole, setWizRole] = useState("All-rounder");
  const [wizBatting, setWizBatting] = useState("Right-hand");
  const [wizBowling, setWizBowling] = useState("Right-arm medium");
  const [wizCity, setWizCity] = useState("Mumbai");
  const [wizCountry, setWizCountry] = useState("India");
  const [wizSaving, setWizSaving] = useState(false);

  const handleWizardNext = async () => {
    if (wizardStep < 3) {
      if (wizardStep === 0) {
        if (!wizAge || !wizJersey) {
          toast.error("Please fill in both age and jersey number.");
          return;
        }
        if (Number(wizAge) <= 0 || Number(wizJersey) < 0) {
          toast.error("Please enter valid numbers.");
          return;
        }
      }
      setWizardStep(wizardStep + 1);
    } else {
      if (!wizCity.trim() || !wizCountry.trim()) {
        toast.error("Please fill in both city and country.");
        return;
      }
      setWizSaving(true);
      try {
        await updatePlayer({
          data: {
            id: user!.playerId!,
            city: wizCity,
            country: wizCountry,
            role: wizRole,
            battingStyle: wizBatting,
            bowlingStyle: wizBowling,
            jersey: wizJersey,
            age: wizAge,
            onboardedProfile: true,
          }
        });
        setUser({ ...user!, onboardedProfile: true });
        toast.success("Profile setup complete!");
      } catch (err: any) {
        toast.error(err.message || "Failed to save profile details.");
      } finally {
        setWizSaving(false);
      }
    }
  };

  // ponytail: SSE real-time notifications
  useNotificationStream(user?.playerId);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        if (!currentUser) {
          navigate("/login");
        }
      } catch (e) {
        console.error("Error checking session:", e);
        navigate("/login");
      }
    };
    checkSession();
  }, [setUser, navigate]);


  // Show back button on detail/sub-pages (not on top-level tabs)
  const topLevelPaths = ["/home", "/tournaments", "/teams", "/profile", "/login", "/onboarding"];
  const isTopLevel = topLevelPaths.some((p) => pathname === p);
  const showBack = !isTopLevel && pathname !== "/";

  return (
    <div className="min-h-screen pb-24 relative">
      <BackgroundShader />
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/30 border-b border-border/40 rounded-b-3xl">
        <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 py-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="h-9 w-9 rounded-xl bg-elevated/60 hover:bg-elevated border border-border/40 grid place-items-center text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0 animate-slide-right"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <Link to="/home" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl gradient-lime grid place-items-center font-display text-lg text-primary-foreground shadow-glow">
              SN
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg">{title || "Stadium Night"}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Cricket League
              </div>
            </div>
          </Link>
          <div className="flex-1" />
          {user && (
            <button
              onClick={() => setAddFriendOpen(true)}
              className="h-9 w-9 grid place-items-center rounded-full bg-elevated hover:bg-muted transition cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Add Friend"
            >
              <UserPlus className="h-4.5 w-4.5" />
            </button>
          )}
          <button
            onClick={() => setNotificationsModalOpen(true)}
            className="relative h-9 w-9 grid place-items-center rounded-full bg-elevated hover:bg-muted transition cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
                {unread}
              </span>
            )}
          </button>
          {user ? (
            <button
              onClick={() => setLightboxOpen(true)}
              className="focus:outline-none transition transform hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="View profile picture"
            >
              <Avatar className="h-9 w-9 border border-border">
                {user.picture && <AvatarImage src={user.picture} alt={user.name} />}
                <AvatarFallback className="bg-elevated text-foreground text-xs">
                  {user.avatar}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Button size="sm" variant="lime" onClick={() => setAuthModalOpen(true)}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 animate-fade-up">{children}</main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 animate-slide-up"
        style={{ animationDelay: "100ms" }}
      >
        {/* Full-width frosted glass floor */}
        <div className="absolute inset-0 bg-background/70 backdrop-blur-2xl border-t border-border/30 rounded-t-3xl -z-10" />
        <div className="mx-auto max-w-2xl px-3 pb-3 pt-2">
          <div className="bg-elevated/50 backdrop-blur-xl border border-border/50 rounded-2xl shadow-card flex items-center justify-around p-1.5">
            {tabs.map((t) => {
              const active = t.to ? pathname.startsWith(t.to) : false;
              const Icon = t.icon;
              if (t.primary) {
                return (
                  <button
                    key={t.label}
                    onClick={() => setCreateModalOpen(true)}
                    className="-mt-7 cursor-pointer border-none bg-transparent tap-scale"
                  >
                    <div className="h-14 w-14 rounded-2xl gradient-lime grid place-items-center shadow-glow border-4 border-background animate-bounce-in" style={{ animationDelay: "200ms" }}>
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </button>
                );
              }
              return (
                <Link
                  key={t.to || t.label}
                  to={t.to!}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all duration-200 ${
                    active
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-all duration-200 ${active ? "drop-shadow-[0_0_6px_oklch(0.92_0.21_125/80%)] scale-110" : ""}`} />
                  <span className={`text-[10px] font-medium transition-all duration-200 ${active ? "font-bold" : ""}`}>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <CreateModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <NotificationsModal open={notificationsModalOpen} onOpenChange={setNotificationsModalOpen} />
      <AddFriendModal open={addFriendOpen} onOpenChange={setAddFriendOpen} />

      {/* Lightbox Dialog to view profile photo clearly */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-sm border border-border/40 rounded-3xl p-6 glass-card shadow-2xl flex flex-col items-center justify-center">
          <DialogTitle className="font-display text-lg text-foreground text-center mb-2 border-b border-border/10 pb-2 w-full">
            {user?.name}'s Profile
          </DialogTitle>
          <div className="relative h-64 w-64 rounded-full overflow-hidden border border-primary/25 shadow-glow flex items-center justify-center bg-elevated/20">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-full w-full object-cover animate-scale-in"
              />
            ) : (
              <div className="h-full w-full bg-primary text-primary-foreground font-display text-7xl font-bold flex items-center justify-center">
                {user?.avatar}
              </div>
            )}
          </div>
          <div className="mt-5 flex gap-2 w-full">
            <Button variant="outline" onClick={() => setLightboxOpen(false)} className="rounded-xl flex-1 cursor-pointer">
              Close
            </Button>
             <Button 
              variant="lime" 
              onClick={() => { 
                setLightboxOpen(false); 
                if (pathname === "/profile") {
                  window.dispatchEvent(new Event("trigger-avatar-upload"));
                } else {
                  sessionStorage.setItem("autoTriggerUpload", "true");
                  navigate("/profile"); 
                }
              }} 
              className="rounded-xl flex-1 shadow-glow cursor-pointer"
             >
               Edit Photo
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Setup Wizard */}
      <Dialog open={!!user && !user.onboardedProfile} onOpenChange={() => {}}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl bg-elevated/90 backdrop-blur-xl [&>button]:hidden"
        >
          <DialogTitle className="font-display text-2xl mb-2 text-foreground text-center">
            {wizardStep === 0 && "Welcome to Stadium Night"}
            {wizardStep === 1 && "Select Your Role"}
            {wizardStep === 2 && "Playing Style"}
            {wizardStep === 3 && "Location & Origin"}
          </DialogTitle>
          
          <div className="text-center text-xs text-muted-foreground mb-4">
            Step {wizardStep + 1} of 4
          </div>

          <div className="space-y-4">
            {wizardStep === 0 && (
              <div className="space-y-4 animate-fade-up">
                <p className="text-xs text-muted-foreground text-center">
                  Let's set up your player profile details to get you ready for matches and stats!
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Age</label>
                  <input
                    type="number"
                    value={wizAge}
                    onChange={(e) => setWizAge(e.target.value)}
                    placeholder="Enter your age"
                    className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b]/50 text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Jersey Number</label>
                  <input
                    type="number"
                    value={wizJersey}
                    onChange={(e) => setWizJersey(e.target.value)}
                    placeholder="Enter your favorite number"
                    className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b]/50 text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="grid grid-cols-2 gap-2 animate-fade-up">
                {["Batsman", "Bowler", "All-rounder", "Wicket-keeper"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setWizRole(r)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-24 transition cursor-pointer ${
                      wizRole === r
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-[#11223b]/25 hover:border-border/60 text-muted-foreground"
                    }`}
                  >
                    <span className="font-semibold text-sm">{r}</span>
                  </button>
                ))}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4 animate-fade-up">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Batting Style</label>
                  <select
                    value={wizBatting}
                    onChange={(e) => setWizBatting(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b]/50 text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Right-hand">Right-hand Bat</option>
                    <option value="Left-hand">Left-hand Bat</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Bowling Style</label>
                  <select
                    value={wizBowling}
                    onChange={(e) => setWizBowling(e.target.value)}
                    className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b]/50 text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Right-arm fast">Right-arm fast</option>
                    <option value="Right-arm medium">Right-arm medium</option>
                    <option value="Right-arm spin">Right-arm spin</option>
                    <option value="Left-arm fast">Left-arm fast</option>
                    <option value="Left-arm medium">Left-arm medium</option>
                    <option value="Left-arm spin">Left-arm spin</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4 animate-fade-up">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">City</label>
                  <input
                    type="text"
                    value={wizCity}
                    onChange={(e) => setWizCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b]/50 text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Country</label>
                  <input
                    type="text"
                    value={wizCountry}
                    onChange={(e) => setWizCountry(e.target.value)}
                    placeholder="e.g. India"
                    className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b]/50 text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-6 pt-3 border-t border-border/20">
            {wizardStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setWizardStep(wizardStep - 1)}
                className="rounded-xl cursor-pointer"
                disabled={wizSaving}
              >
                Back
              </Button>
            )}
            <Button
              variant="lime"
              onClick={handleWizardNext}
              disabled={wizSaving}
              className="rounded-xl cursor-pointer shadow-glow font-bold animate-fade-up"
            >
              {wizardStep === 3 ? (wizSaving ? "Saving..." : "Finish") : "Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3 mt-6 first:mt-0">
      <h2 className="font-display text-2xl">{children}</h2>
      {action}
    </div>
  );
}

export function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${accent ? "border-primary/40 bg-primary/10" : "border-border bg-elevated"}`}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}
