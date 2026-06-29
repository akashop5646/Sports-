import { Link } from "react-router-dom";
import { AppShell, StatPill } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getPlayer, getTeam, getPlayerCertificates, updatePlayer, uploadProfilePicture } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Award, LogOut, ChevronRight, MapPin, User, Sparkles, Zap, Edit2, Camera } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function Profile() {
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const signOut = useApp((s) => s.signOut);
  const setAuthModalOpen = useApp((s) => s.setAuthModalOpen);
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Image Editor / Cropper State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 240, height: 240 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const constrainPosition = (x: number, y: number, currentScale: number) => {
    return { x, y };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const src = reader.result as string;
      setCropImageSrc(src);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });

      // Calculate base image size to fit 240x240 circle
      const img = new Image();
      img.onload = () => {
        const maxDimension = Math.max(img.width, img.height);
        const baseWidth = (img.width / maxDimension) * 240;
        const baseHeight = (img.height / maxDimension) * 240;
        setImgSize({ width: baseWidth, height: baseHeight });
      };
      img.src = src;
    };
    reader.onerror = () => {
      toast.error("Failed to read image file.");
    };
    reader.readAsDataURL(file);

    // Reset value so selection of same file fires onChange again
    e.target.value = "";
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    setPosition({ x: rawX, y: rawY });
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStart || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
  };

  const handleTouchEnd = () => {
    setDragStart(null);
  };

  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
  };

  const handleCropSave = () => {
    if (!cropImageSrc) return;
    
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw circular clip path
      ctx.beginPath();
      ctx.arc(200, 200, 200, 0, Math.PI * 2);
      ctx.clip();

      // Clear canvas (transparent background)
      ctx.clearRect(0, 0, 400, 400);

      ctx.save();
      const ratio = 400 / 240;
      ctx.translate(200 + position.x * ratio, 200 + position.y * ratio);
      ctx.rotate((rotation * Math.PI) / 180);
      
      const drawWidth = imgSize.width * scale * ratio;
      const drawHeight = imgSize.height * scale * ratio;

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      const base64 = canvas.toDataURL("image/jpeg", 0.85);
      setUploadingPic(true);
      setCropImageSrc(null);

      try {
        await uploadProfilePicture({ picture: base64 });
        setUser({ ...user!, picture: base64 });
        toast.success("Profile picture updated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to upload profile picture.");
      } finally {
        setUploadingPic(false);
      }
    };
    img.src = cropImageSrc;
  };

  const handleRemovePhoto = async () => {
    setUploadingPic(true);
    try {
      await uploadProfilePicture({ action: "remove" });
      setUser({ ...user!, picture: null });
      toast.success("Profile picture removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove profile picture.");
    } finally {
      setUploadingPic(false);
    }
  };

  const handleRestoreGooglePhoto = async () => {
    setUploadingPic(true);
    try {
      const res = await uploadProfilePicture({ action: "restore_google" });
      setUser({ ...user!, picture: res.picture });
      toast.success("Restored Google profile picture!");
    } catch (err: any) {
      toast.error(err.message || "Failed to restore Google profile picture.");
    } finally {
      setUploadingPic(false);
    }
  };

  // Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [battingStyle, setBattingStyle] = useState("");
  const [bowlingStyle, setBowlingStyle] = useState("");

  useEffect(() => {
    document.title = "Profile — Stadium Night";
  }, []);

  // Queries
  const { data: p, isLoading: loadingPlayer } = useQuery({
    queryKey: ["player", user?.playerId],
    queryFn: () => getPlayer({ data: user?.playerId }),
    enabled: !!user && !!user.playerId,
  });

  const { data: team, isLoading: loadingTeam } = useQuery({
    queryKey: ["team", user?.teamId],
    queryFn: () => getTeam({ data: user?.teamId }),
    enabled: !!user && !!user.teamId,
  });

  const { data: certs = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["player-certs", user?.playerId],
    queryFn: () => getPlayerCertificates({ data: user?.playerId }),
    enabled: !!user && !!user.playerId,
  });
  // Mutation to update player
  const updateMutation = useMutation({
    mutationFn: (variables: any) => updatePlayer(variables),
    onSuccess: () => {
      toast.success("Profile details updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["player", user?.playerId || ""] });
      setIsEditOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile details.");
    },
  });

  if (!user) {
    return (
      <AppShell title="Profile">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Sign in to view your profile.</p>
          <Button variant="lime" onClick={() => setAuthModalOpen(true)}>
            Sign in
          </Button>
        </div>
      </AppShell>
    );
  }

  const isLoading = loadingPlayer || loadingTeam || loadingCerts;

  const handleOpenEdit = () => {
    setCity(p?.city || "");
    setCountry(p?.country || "");
    setRole(p?.role || "All-rounder");
    setBattingStyle(p?.battingStyle || "Right-hand");
    setBowlingStyle(p?.bowlingStyle || "Right-arm medium");
    setIsEditOpen(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: user?.playerId,
      city: city.trim(),
      country: country.trim(),
      role,
      battingStyle,
      bowlingStyle,
    });
  };

  return (
    <AppShell title="Profile">
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <div className="h-8 w-8 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="gradient-card border border-border rounded-2xl p-5 shadow-card text-center relative">
            {p && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenEdit}
                className="absolute top-4 right-4 h-8 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit Profile
              </Button>
            )}
            <div className="relative mx-auto h-20 w-20 group">
              <Avatar className="h-full w-full border-2 border-primary/20 shadow-lg animate-scale-in">
                {user.picture && <AvatarImage src={user.picture} alt={user.name} />}
                <AvatarFallback className="bg-primary text-primary-foreground font-display text-3xl font-bold flex items-center justify-center h-full w-full">
                  {user.avatar}
                </AvatarFallback>
              </Avatar>

              {uploadingPic && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white">
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition shadow-md">
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="glass-card border border-border/40 min-w-[160px]">
                  <DropdownMenuItem onClick={handleAvatarClick} className="cursor-pointer text-xs flex items-center gap-2">
                    Change photo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRestoreGooglePhoto} className="cursor-pointer text-xs flex items-center gap-2">
                    Use Google Photo
                  </DropdownMenuItem>
                  {user.picture && (
                    <DropdownMenuItem onClick={handleRemovePhoto} className="cursor-pointer text-xs text-destructive focus:text-destructive flex items-center gap-2">
                      Remove photo
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <h1 className="font-display text-2xl mt-3">{user.name}</h1>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            
            {p && (p.city || p.country) && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3 text-primary" />
                {[p.city, p.country].filter(Boolean).join(", ")}
              </div>
            )}

            {team ? (
              <Link
                to={`/teams/${team.id}`}
                className="inline-flex items-center gap-1 text-primary text-sm mt-2 font-medium hover:underline"
              >
                {team.name} <ChevronRight className="h-3 w-3" />
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground/60 mt-2">No active team registered</div>
            )}
          </div>

          {/* Custom Details Display (only if saved) */}
          {p && (p.city || p.country || p.role || p.battingStyle || p.bowlingStyle) && (
            <div className="gradient-card border border-border rounded-2xl p-5 shadow-card mt-4 flex flex-col gap-3">
              <h3 className="font-display text-lg mb-1">Player Profile Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {p.role && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Role</div>
                      <div className="text-foreground font-medium">{p.role}</div>
                    </div>
                  </div>
                )}
                {p.battingStyle && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Batting Style</div>
                      <div className="text-foreground font-medium">{p.battingStyle}</div>
                    </div>
                  </div>
                )}
                {p.bowlingStyle && p.bowlingStyle !== "None" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Bowling Style</div>
                      <div className="text-foreground font-medium">{p.bowlingStyle}</div>
                    </div>
                  </div>
                )}
                {(p.city || p.country) && (
                  <div className="flex items-center gap-2 text-muted-foreground col-span-2 border-t border-border/20 pt-2.5 mt-1">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Location</div>
                      <div className="text-foreground font-medium">
                        {[p.city, p.country].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          {p && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <StatPill label="M" value={p.stats?.matches || 0} />
              <StatPill label="Runs" value={p.stats?.runs || 0} accent />
              <StatPill label="Wkts" value={p.stats?.wickets || 0} />
              <StatPill label="HS" value={p.stats?.highScore || 0} />
            </div>
          )}

          <h2 className="font-display text-2xl mt-6 mb-3">My certificates</h2>
          <div className="grid gap-2">
            {certs.length === 0 && (
              <div className="text-sm text-muted-foreground py-4">
                No certificates yet — win a tournament!
              </div>
            )}
            {certs.map((c: any) => (
              <Link
                key={c.id}
                to="/certificates"
                className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
              >
                <Award className="h-5 w-5 text-primary" />
                <span className="flex-1 text-sm font-medium">{c.type}</span>
                <span className="text-xs text-muted-foreground">{c.issuedOn}</span>
              </Link>
            ))}
          </div>

          <Button variant="hero" className="w-full mt-6 cursor-pointer" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>

          {/* Edit Profile Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl">
              <DialogTitle className="font-display text-2xl mb-4 text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
                <Edit2 className="h-5 w-5 text-muted-foreground" />
                Edit Player Profile
              </DialogTitle>
              <div className="space-y-4">
                
                {/* Location Section */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-1.5 border-b border-border/20 pb-1">
                    <MapPin className="h-3.5 w-3.5" /> Location
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">City</label>
                      <Input
                        type="text"
                        placeholder="e.g. Mumbai"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="bg-elevated/20 border-border/60 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Country</label>
                      <Input
                        type="text"
                        placeholder="e.g. India"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="bg-elevated/20 border-border/60 focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Cricket Profile Section */}
                <div className="space-y-3 pt-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-1.5 border-b border-border/20 pb-1">
                    <Sparkles className="h-3.5 w-3.5" /> Cricket Details
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                      <User className="h-3 w-3" /> Player Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-border/60 bg-elevated/35 text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:border-primary/40"
                    >
                      <option value="Batter">Batter</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All-rounder">All-rounder</option>
                      <option value="Wicket-keeper">Wicket-keeper</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Batting
                      </label>
                      <select
                        value={battingStyle}
                        onChange={(e) => setBattingStyle(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border/60 bg-elevated/35 text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:border-primary/40"
                      >
                        <option value="Right-hand">Right-hand</option>
                        <option value="Left-hand">Left-hand</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Bowling
                      </label>
                      <select
                        value={bowlingStyle}
                        onChange={(e) => setBowlingStyle(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-border/60 bg-elevated/35 text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:border-primary/40"
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
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 justify-end pt-4 border-t border-border/20">
                  <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl px-4 cursor-pointer">
                    Cancel
                  </Button>
                  <Button variant="lime" onClick={handleSave} disabled={updateMutation.isPending} className="rounded-xl px-5 cursor-pointer shadow-glow">
                    {updateMutation.isPending ? "Saving..." : "Save Details"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit & Crop Photo Dialog */}
          <Dialog open={!!cropImageSrc} onOpenChange={(open) => !open && setCropImageSrc(null)}>
            <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl">
              <DialogTitle className="font-display text-2xl mb-4 text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
                <Camera className="h-5 w-5 text-muted-foreground" />
                Edit & Crop Photo
              </DialogTitle>
              <div className="space-y-5">
                
                {/* Crop Viewport */}
                <div className="relative flex justify-center py-2 bg-black/10 rounded-2xl border border-border/10">
                  <div 
                    className="relative h-60 w-60 rounded-full border-2 border-primary/40 overflow-hidden cursor-move select-none bg-elevated/20 shadow-inner touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {cropImageSrc && (
                      <img
                        src={cropImageSrc}
                        alt="Crop preview"
                        className="absolute max-w-none pointer-events-none origin-center"
                        style={{
                          width: `${imgSize.width}px`,
                          height: `${imgSize.height}px`,
                          left: `calc(50% - ${imgSize.width / 2}px)`,
                          top: `calc(50% - ${imgSize.height / 2}px)`,
                          transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground text-center -mt-2">
                  💡 Drag image inside circle to pan/center.
                </div>

                {/* Sizing & Orientation Controls */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1">Zoom</span>
                      <span>{scale.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="3.0" 
                      step="0.05"
                      value={scale} 
                      onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                      className="w-full accent-primary bg-elevated/45 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>Rotate</span>
                      <span>{rotation}°</span>
                    </div>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="1"
                      value={rotation} 
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                      className="w-full accent-primary bg-elevated/45 h-1.5 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-between pt-4 border-t border-border/20">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setScale(1);
                      setRotation(0);
                      setPosition({ x: 0, y: 0 });
                    }} 
                    className="rounded-xl px-3 text-xs cursor-pointer"
                  >
                    Reset
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setCropImageSrc(null)} className="rounded-xl px-4 cursor-pointer">
                      Cancel
                    </Button>
                    <Button variant="lime" onClick={handleCropSave} className="rounded-xl px-5 cursor-pointer shadow-glow">
                      Save & Upload
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AppShell>
  );
}
