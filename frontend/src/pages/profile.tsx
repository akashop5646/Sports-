import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getPlayer, getTeam, getPlayerCertificates, updatePlayer, uploadProfilePicture } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Award, LogOut, ChevronRight, MapPin, User, Sparkles, Zap, Edit2, Camera, Hash, Users, UserPlus, Copy, Calendar, Shield, BadgeCheck } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { CricketLoading, useLoadingState } from "@/components/CricketLoading";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getFriends } from "@/lib/api";
import { AddFriendModal } from "@/components/AddFriendModal";
import { AllFriendsModal } from "@/components/AllFriendsModal";

const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context is null"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export default function Profile() {
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const signOut = useApp((s) => s.signOut);
  const setAuthModalOpen = useApp((s) => s.setAuthModalOpen);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    setUploadingPic(true);
    try {
      // Compress the image immediately on selection to avoid large memory usage and potential payload limits
      const compressedSrc = await compressImage(file, 1200, 1200, 0.85);
      
      setCropImageSrc(compressedSrc);
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
      img.src = compressedSrc;
    } catch (err) {
      console.error("Image compression error:", err);
      toast.error("Failed to process image.");
    } finally {
      setUploadingPic(false);
    }

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [city, setCity] = useState("");

  const handleSignOut = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      signOut();
      navigate("/login");
    }, 1200);
  };
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [battingStyle, setBattingStyle] = useState("");
  const [bowlingStyle, setBowlingStyle] = useState("");
  const [jersey, setJersey] = useState<number | string>("");
  const [age, setAge] = useState<number | string>("");

  useEffect(() => {
    document.title = "Profile — Stadium Night";

    const handleTrigger = () => {
      handleAvatarClick();
    };
    window.addEventListener("trigger-avatar-upload", handleTrigger);

    // Check for sessionStorage flag on mount
    if (sessionStorage.getItem("autoTriggerUpload") === "true") {
      sessionStorage.removeItem("autoTriggerUpload");
      setTimeout(() => {
        handleAvatarClick();
      }, 100);
    }

    return () => {
      window.removeEventListener("trigger-avatar-upload", handleTrigger);
    };
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

  // Friends
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isAllFriendsOpen, setIsAllFriendsOpen] = useState(false);
  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: !!user,
  });
  const { friends = [] } = friendsData || {};

  const isLoading = useLoadingState(loadingPlayer || loadingTeam || loadingCerts);

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

  const handleOpenEdit = () => {
    setCity(p?.city || "");
    setCountry(p?.country || "");
    setRole(p?.role || "All-rounder");
    setBattingStyle(p?.battingStyle || "Right-hand");
    setBowlingStyle(p?.bowlingStyle || "Right-arm medium");
    setJersey(p?.jersey ?? "");
    setAge(p?.age ?? "");
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
      jersey: jersey === "" ? null : Number(jersey),
      age: age === "" ? null : Number(age),
    });
  };

  if (isLoading) {
    return (
      <AppShell title="Profile">
        <CricketLoading />
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile">
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
                <DropdownMenuContent align="center" className="bg-popover/95 backdrop-blur-xl border border-border/40 min-w-[160px] shadow-2xl rounded-xl p-1.5 z-50">
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
            <h1 className="font-display text-2xl mt-3 flex items-center justify-center gap-1.5">
              {user.name}
              {user.verified && (
                <span title="Verified Athlete" className="inline-block shrink-0">
                  <BadgeCheck className="h-5 w-5 text-white fill-[#0095f6]" />
                </span>
              )}
            </h1>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            {user.playerCode && (
              <div className="mt-2 flex items-center justify-center gap-1.5 animate-fade-up">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Player Code:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.playerCode || "");
                    toast.success("Player code copied to clipboard!");
                  }}
                  className="font-mono text-xs bg-white/5 border border-border/40 hover:border-primary/60 hover:bg-white/10 transition px-2 py-0.5 rounded flex items-center gap-1 text-primary cursor-pointer"
                  title="Click to copy Player Code"
                >
                  {user.playerCode}
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            )}
            
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

          {/* Custom Details Display */}
          {p && (
            <div className="mt-4 flex flex-col gap-3">
              <h3 className="font-display text-lg px-1">Player Profile Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col items-center text-center justify-center transition hover:border-primary/20 hover:bg-elevated/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5 justify-center">
                    <User className="h-3.5 w-3.5 text-primary" /> Role
                  </span>
                  <span className="text-sm font-semibold mt-2 text-foreground">{p.role || "Player"}</span>
                </div>
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col items-center text-center justify-center transition hover:border-primary/20 hover:bg-elevated/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5 justify-center">
                    <Hash className="h-3.5 w-3.5 text-primary" /> Jersey #
                  </span>
                  <span className="text-sm font-semibold mt-2 text-foreground">
                    {p.jersey !== undefined && p.jersey !== null && p.jersey !== "" ? `#${p.jersey}` : "—"}
                  </span>
                </div>
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col items-center text-center justify-center transition hover:border-primary/20 hover:bg-elevated/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5 justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-secondary" /> Batting
                  </span>
                  <span className="text-sm font-semibold mt-2 text-foreground">{p.battingStyle || "Right-hand"}</span>
                </div>
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col items-center text-center justify-center transition hover:border-primary/20 hover:bg-elevated/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5 justify-center">
                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Bowling
                  </span>
                  <span className="text-sm font-semibold mt-2 text-foreground">{p.bowlingStyle || "None"}</span>
                </div>
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col items-center text-center justify-center transition hover:border-primary/20 hover:bg-elevated/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5 justify-center">
                    <MapPin className="h-3.5 w-3.5 text-destructive" /> Location
                  </span>
                  <span className="text-sm font-semibold mt-2 text-foreground truncate max-w-full">
                    {[p.city, p.country].filter(Boolean).join(", ") || "India"}
                  </span>
                </div>
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col items-center text-center justify-center transition hover:border-primary/20 hover:bg-elevated/40">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5 justify-center">
                    <Calendar className="h-3.5 w-3.5 text-emerald-500" /> Age
                  </span>
                  <span className="text-sm font-semibold mt-2 text-foreground">
                    {p.age !== undefined && p.age !== null && p.age !== "" ? `${p.age} years` : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Friends Section */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Friends
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddFriendOpen(true)}
                className="h-8 px-2 text-xs text-primary hover:text-primary/80 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Friend
              </Button>
            </div>
            <div className="gradient-card border border-border rounded-2xl p-4 shadow-card">
              {loadingFriends ? (
                <div className="text-center py-4 text-xs text-muted-foreground">Loading friends...</div>
              ) : friends.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No friends added yet</p>
                  <Button variant="lime" size="sm" onClick={() => setIsAddFriendOpen(true)} className="cursor-pointer rounded-xl text-xs">
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Your First Friend
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {friends.slice(0, 6).map((f: any) => (
                      <Link
                        key={f.id}
                        to={`/players/${f.id}`}
                        className="bg-elevated/15 border border-border/30 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:border-border/60 transition text-center"
                      >
                        <Avatar className="h-10 w-10 border border-border/40">
                          {f.picture && <AvatarImage src={f.picture} alt={f.name} />}
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-display font-bold">
                            {f.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 w-full">
                          <div className="text-xs font-semibold truncate text-foreground">{f.name}</div>
                          <div className="text-[9px] text-muted-foreground truncate">{f.role}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <button
                    onClick={() => setIsAllFriendsOpen(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium mt-3 py-2 rounded-xl border border-border/30 hover:border-primary/30 bg-elevated/10 hover:bg-elevated/20 transition cursor-pointer"
                  >
                    See All Friends ({friends.length})
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <AddFriendModal
            open={isAddFriendOpen}
            onOpenChange={setIsAddFriendOpen}
          />

          <AllFriendsModal open={isAllFriendsOpen} onOpenChange={setIsAllFriendsOpen} />

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

          {(user.role === "admin" || user.email === "mk1125709@gmail.com") && (
            <Link to="/admin" className="block w-full mt-6">
              <Button variant="lime" className="w-full cursor-pointer flex items-center justify-center gap-2 font-semibold">
                <Shield className="h-4 w-4" /> Admin Panel
              </Button>
            </Link>
          )}

          <Button variant="hero" className="w-full mt-6 cursor-pointer" onClick={handleSignOut}>
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
                  
                  <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
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

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Jersey #
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 7"
                        value={jersey}
                        onChange={(e) => setJersey(e.target.value)}
                        className="bg-elevated/20 border-border/60 focus:border-primary h-9"
                        min="0"
                        max="999"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <User className="h-3 w-3" /> Age
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 25"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="bg-elevated/20 border-border/60 focus:border-primary h-9"
                        min="0"
                        max="150"
                      />
                    </div>
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
          <Dialog open={!!cropImageSrc} onOpenChange={(open: boolean) => !open && setCropImageSrc(null)}>
            <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl">
              <DialogTitle className="font-display text-2xl mb-4 text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
                <Camera className="h-5 w-5 text-muted-foreground" />
                Edit & Crop Photo
              </DialogTitle>
              <div className="space-y-5">
                
                {/* Crop Viewport */}
                <div className="relative flex justify-center py-2 bg-black/10 rounded-2xl border border-border/10">
                  <div 
                    className="relative h-60 w-60 rounded-2xl border-2 border-primary/40 overflow-hidden cursor-move select-none bg-elevated/20 shadow-inner touch-none"
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

                    {/* Circular guideline and darkened corners overlay (Instagram style) */}
                    <div 
                      className="absolute inset-0 rounded-full border border-dashed border-white/60 pointer-events-none z-10"
                      style={{
                        boxShadow: "0 0 0 9999px rgba(10, 22, 40, 0.6)"
                      }}
                    />
                  </div>
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

          {isLoggingOut && (
            <div className="fixed inset-0 z-50 bg-[#070b13]/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
              <div className="text-center space-y-6">
                <CricketLoading />
                <div className="space-y-2 animate-pulse">
                  <h2 className="font-display text-2xl font-bold text-foreground">Signing you out</h2>
                  <p className="text-sm text-primary font-medium tracking-wide uppercase">See you soon on the field! 🏏</p>
                </div>
              </div>
            </div>
          )}
    </AppShell>
  );
}
