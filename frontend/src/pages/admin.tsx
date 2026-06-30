import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  Users, 
  Activity, 
  Search, 
  BadgeCheck, 
  Settings, 
  Mail, 
  TrendingUp, 
  Trophy, 
  Zap, 
  Sparkles,
  RefreshCw,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";

interface AnalyticsData {
  totals: {
    users: number;
    teams: number;
    tournaments: number;
    matches: number;
    liveMatches: number;
    completedMatches: number;
    scorings: number;
    onlineUsers: number;
  };
  formatStats: Record<string, number>;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  avatar: string;
  role: string;
  verified: boolean;
  playerId?: string;
  createdAt: string;
  isOnline: boolean;
}

export default function AdminPanel() {
  const user = useApp((s) => s.user);
  const [activeTab, setActiveTab] = useState<"analytics" | "users" | "settings">("analytics");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Auto redirect if not logged in or not admin
  if (!user || (user.role !== "admin" && user.email !== "mk1125709@gmail.com")) {
    return <Navigate to="/profile" replace />;
  }

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load analytics");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsersList(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users");
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchAnalytics(), fetchUsers()]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleVerify = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: !currentStatus })
      });
      if (!res.ok) throw new Error("Failed to update verification status");
      
      toast.success(currentStatus ? "User verification removed" : "User successfully verified!");
      // Update local state
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, verified: !currentStatus } : u));
      fetchAnalytics(); // Refresh online/totals in analytics if verified affects anything
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail.trim() })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to add admin");
      }

      toast.success(data.message || "Admin assigned successfully!");
      setNewAdminEmail("");
      fetchUsers(); // Refresh role listings
    } catch (err: any) {
      toast.error(err.message || "Failed to assign admin");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email.toLowerCase() === "mk1125709@gmail.com") {
      toast.error("Cannot remove primary administrator.");
      return;
    }
    if (user?.email && email.toLowerCase() === user.email.toLowerCase()) {
      toast.error("Cannot remove yourself as administrator.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove admin");
      }
      toast.success(data.message || "Admin access revoked successfully!");
      fetchUsers(); // Refresh listings
    } catch (err: any) {
      toast.error(err.message || "Failed to remove admin");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users by search query
  const filteredUsers = usersList.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell title="Admin Panel">
      <div className="space-y-6 pb-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-lime grid place-items-center text-primary-foreground shadow-glow">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">Manage users, view real-time system metrics, and set admins.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 px-2 cursor-pointer flex items-center gap-1.5" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-border/30 gap-6">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`pb-3 text-sm font-semibold relative cursor-pointer ${
              activeTab === "analytics" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Analytics Dashboard
            {activeTab === "analytics" && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-sm font-semibold relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === "users" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Users Directory
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full font-normal">
              {usersList.length}
            </span>
            {activeTab === "users" && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 text-sm font-semibold relative cursor-pointer ${
              activeTab === "settings" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            System Settings
            {activeTab === "settings" && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Gathering system data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* 1. ANALYTICS TAB */}
            {activeTab === "analytics" && analytics && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300">
                      <Users className="h-12 w-12 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Users</span>
                    <h2 className="text-3xl font-black mt-2 text-foreground font-display">{analytics.totals.users}</h2>
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-primary inline-block animate-pulse" />
                      Stadium Night Network
                    </div>
                  </div>

                  <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300">
                      <Activity className="h-12 w-12 text-emerald-400" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Active Online</span>
                    <h2 className="text-3xl font-black mt-2 text-emerald-400 font-display flex items-baseline gap-1">
                      {analytics.totals.onlineUsers}
                      <span className="text-xs font-normal text-muted-foreground">online</span>
                    </h2>
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                      Live connected clients
                    </div>
                  </div>

                  <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300">
                      <Trophy className="h-12 w-12 text-yellow-400" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Tournaments</span>
                    <h2 className="text-3xl font-black mt-2 text-foreground font-display">{analytics.totals.tournaments}</h2>
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block animate-pulse" />
                      Active brackets running
                    </div>
                  </div>

                  <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition duration-300">
                      <Zap className="h-12 w-12 text-orange-400" />
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Live Matches</span>
                    <h2 className="text-3xl font-black mt-2 text-orange-400 font-display flex items-baseline gap-1">
                      {analytics.totals.liveMatches}
                      <span className="text-xs font-normal text-muted-foreground">active</span>
                    </h2>
                    <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-orange-400 inline-block animate-pulse" />
                      Being scored right now
                    </div>
                  </div>
                </div>

                {/* Sub Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left block - Match detailed totals */}
                  <div className="bg-elevated/20 border border-border/30 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> Live System Performance
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Total Matches Registered</span>
                          <span className="font-bold">{analytics.totals.matches}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: "100%" }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Completed Matches</span>
                          <span className="font-bold">{analytics.totals.completedMatches}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${analytics.totals.matches ? (analytics.totals.completedMatches / analytics.totals.matches) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Total Active Teams</span>
                          <span className="font-bold">{analytics.totals.teams}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full" style={{ width: "100%" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right block - Tournament Format Distributions */}
                  <div className="bg-elevated/20 border border-border/30 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-yellow-400" /> Tournament Format Share
                    </h3>
                    
                    <div className="space-y-3">
                      {Object.keys(analytics.formatStats).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">No tournaments created yet</p>
                      ) : (
                        Object.entries(analytics.formatStats).map(([format, count]) => {
                          const percentage = (count / analytics.totals.tournaments) * 100;
                          return (
                            <div key={format} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="capitalize font-medium text-foreground">{format} format</span>
                                <span className="text-muted-foreground">{count} tournaments ({percentage.toFixed(0)}%)</span>
                              </div>
                              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${percentage}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. USERS TAB */}
            {activeTab === "users" && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or Gmail address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-elevated/10 border-border/40 focus:border-primary rounded-xl"
                  />
                </div>

                {/* Users List Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border/30 rounded-2xl col-span-full">
                      <p className="text-sm text-muted-foreground">No users match your criteria.</p>
                    </div>
                  ) : (
                    filteredUsers.map((item) => (
                      <div 
                        key={item.id} 
                        className="bg-elevated/20 border border-border/30 rounded-2xl p-3 flex flex-col items-center text-center justify-between gap-3 transition hover:bg-elevated/35 hover:border-primary/20 relative"
                      >
                        {/* Top Right Online Badge */}
                        {item.isOnline && (
                          <span className="absolute top-3 right-3 h-2 w-2 bg-emerald-400 border border-background rounded-full animate-pulse" title="Online now" />
                        )}

                        {/* Avatar */}
                        <Avatar className="h-10 w-10 border border-border/30">
                          {item.picture && <AvatarImage src={item.picture} alt={item.name} />}
                          <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                            {item.avatar}
                          </AvatarFallback>
                        </Avatar>

                        {/* Details */}
                        <div className="min-w-0 space-y-1 w-full">
                          <div className="flex items-center justify-center gap-1">
                            <span className="font-semibold text-xs text-foreground truncate max-w-[100px] flex items-center gap-0.5">
                              {item.name}
                              {item.verified && (
                                <span title="Verified" className="inline-block shrink-0">
                                  <BadgeCheck className="h-4 w-4 text-white fill-[#0095f6] shrink-0" />
                                </span>
                              )}
                            </span>
                            {item.role === "admin" && (
                              <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 font-bold px-1 py-0.2 rounded-full uppercase tracking-widest scale-90">
                                Ad
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {item.email}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1.5 w-full mt-1">
                          {item.playerId && (
                            <Link to={`/players/${item.playerId}`} className="w-full">
                              <Button size="sm" variant="ghost" className="w-full h-7 text-[10px] font-semibold cursor-pointer py-1">
                                View Profile
                              </Button>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant={item.verified ? "destructive" : "outline"}
                            className="w-full h-7 text-[10px] font-semibold cursor-pointer flex items-center justify-center gap-1 py-1"
                            onClick={() => handleToggleVerify(item.id, item.verified)}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            {item.verified ? "Unverify" : "Verify"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. SETTINGS TAB */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                {/* Admin promotion form */}
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-sm">Assign New Administrator</h3>
                      <p className="text-xs text-muted-foreground">Grant full system administrator roles through their registered Gmail address.</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddAdmin} className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">User Gmail Address</label>
                      <Input
                        type="email"
                        placeholder="e.g. user.cricketer@gmail.com"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="bg-elevated/10 border-border/40 focus:border-primary rounded-xl"
                        required
                      />
                    </div>

                    <Button 
                      type="submit" 
                      variant="lime"
                      className="w-full cursor-pointer flex items-center justify-center gap-2 font-semibold"
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          Assigning Admin...
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4" />
                          Promote User to Admin
                        </>
                      )}
                    </Button>
                  </form>
                </div>

                {/* Administrators List */}
                <div className="bg-elevated/20 border border-border/30 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-sm">System Administrators</h3>
                      <p className="text-xs text-muted-foreground">Active administrators with full system database access.</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    {usersList
                      .filter(u => u.role === "admin" || u.email.toLowerCase() === "mk1125709@gmail.com")
                      .map((admin) => {
                        const isPrimary = admin.email.toLowerCase() === "mk1125709@gmail.com";
                        const isCurrentUser = admin.email.toLowerCase() === user.email?.toLowerCase();
                        
                        return (
                          <div 
                            key={admin.id} 
                            className="bg-elevated/10 border border-border/20 rounded-xl p-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar className="h-8 w-8 border border-border/30">
                                {admin.picture && <AvatarImage src={admin.picture} alt={admin.name} />}
                                <AvatarFallback className="bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                                  {admin.avatar}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold truncate text-foreground flex items-center gap-1">
                                  {admin.name}
                                  {isPrimary && (
                                    <span className="text-[8px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">{admin.email}</div>
                              </div>
                            </div>

                            {/* Demote Button */}
                            {!isPrimary && !isCurrentUser && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-[10px] font-semibold cursor-pointer shrink-0 py-1 px-2.5"
                                onClick={() => handleRemoveAdmin(admin.email)}
                                disabled={actionLoading}
                              >
                                Revoke Admin
                              </Button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* DB Match Reminder Box */}
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl p-4 text-xs leading-relaxed space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-blue-300">
                    <Settings className="h-4 w-4" /> Assignment Policy & Requirements
                  </div>
                  <p>
                    The email specified must already exist in the Stadium Night database. The role update modifies the user role permanently, allowing them full access to the Analytics dashboard, user verification blue tick badges, and system settings.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
