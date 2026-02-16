import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users,
  Share2,
  Trophy,
  Zap,
  Copy,
  CheckCircle,
  UserPlus,
  TrendingUp,
  Target,
  Crown,
  Star,
  Rocket,
  Gift,
  ArrowRight,
  Mail,
  MessageCircle,
  Linkedin,
  Twitter,
  Link as LinkIcon,
  RefreshCw,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { motion } from "framer-motion";

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  referralCode?: string;
  partnerId?: string;
  partnerLevel?: number;
  teamRole?: string;
  isAdmin?: boolean;
}

interface ProgressionData {
  partnerLevel: string;
  teamSize: number;
  totalRevenue: number;
  directRevenue: number;
  overrideRevenue: number;
  totalInvites: number;
  successfulInvites: number;
}

interface InviteMetrics {
  teamMembers: number;
  registered: number;
  active: number;
  inactive: number;
}

interface ProgressionData {
  partnerLevel: string;
  teamSize: number;
  totalRevenue: number;
  directRevenue: number;
  overrideRevenue: number;
  totalInvites: number;
  successfulInvites: number;
  currentXP: number;
  xpToNextLevel: number;
  revenueGrowthPercent: number;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function TeamManagement() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const queryClient = useQueryClient();

  const typedUser = user as User | undefined;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: progressionData, isLoading: isLoadingProgression } = useQuery<ProgressionData>({
    queryKey: ['/api/team/progression'],
    enabled: isAuthenticated,
  });

  const { data: referralStats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<InviteMetrics>({
    queryKey: ['/api/team/referral-stats'],
    enabled: isAuthenticated,
  });

  const { data: teamReferrals, isLoading: isLoadingReferrals, refetch: refetchReferrals } = useQuery<any[]>({
    queryKey: ['/api/team/referrals'],
    enabled: isAuthenticated,
  });

  const inviteMetrics: InviteMetrics = referralStats || {
    teamMembers: 0,
    registered: 0,
    active: 0,
    inactive: 0
  };

  const referralCode = typedUser?.referralCode || `PARTNER${typedUser?.id?.slice(0, 6) || '123'}`;
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const shareVia = (platform: string) => {
    const message = encodeURIComponent(`Join me on PartnerConnector and start earning commissions! Use my referral link: ${referralLink}`);
    let url = '';

    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${message}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent('Join PartnerConnector')}&body=${message}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${message}`;
        break;
    }

    if (url) window.open(url, '_blank');
  };

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchReferrals()]);
    toast({
      title: "Refreshed",
      description: "Team data has been updated",
    });
  };

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('POST', '/api/team/invite', { email });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent!",
        description: "Your team invite has been sent successfully",
      });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ['/api/team/referrals'] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/login";
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail) {
      inviteMutation.mutate(inviteEmail);
    }
  };

  // Get XP and level data from backend (no more hardcoded values)
  const currentXP = progressionData?.currentXP || 0;
  const levels = [
    { name: "Bronze", xp: 0, color: "from-amber-600 to-amber-700", earned: true },
    { name: "Silver", xp: 500, color: "from-gray-400 to-gray-500", earned: currentXP >= 500 },
    { name: "Gold", xp: 1500, color: "from-yellow-400 to-amber-500", earned: currentXP >= 1500 },
    { name: "Platinum", xp: 3500, color: "from-cyan-300 to-blue-400", earned: currentXP >= 3500 },
    { name: "Diamond", xp: 7500, color: "from-purple-400 to-pink-500", earned: currentXP >= 7500 },
  ];
  const currentLevel = levels.find((l, i) => levels[i + 1]?.xp > currentXP) || levels[1];
  const nextLevel = levels[levels.findIndex(l => l.name === currentLevel.name) + 1];
  const progressToNext = nextLevel ? ((currentXP - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100 : 100;

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <Sidebar onExpandChange={setSidebarExpanded} />

      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
        <div className="p-6 lg:p-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Header */}
            <motion.div variants={fadeInUp} className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Team Growth</h1>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {currentLevel.name} Partner
                </Badge>
              </div>
              <p className="text-gray-500">Build your network, track progress, and earn together</p>
            </motion.div>

            {/* Stats Row */}
            <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl hover:border-purple-500/50 transition-colors" data-testid="card-team-members">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-1 rounded-full">Team</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Team Members</p>
                  <div className="text-3xl font-bold text-white" data-testid="text-team-count">{inviteMetrics.teamMembers}</div>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl hover:border-green-500/50 transition-colors" data-testid="card-active">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-lime-400 to-green-500 rounded-xl flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-lime-400 bg-lime-400/10 px-2 py-1 rounded-full">Active</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Active Partners</p>
                  <div className="text-3xl font-bold text-white" data-testid="text-active-count">{inviteMetrics.active}</div>
                </CardContent>
              </Card>


              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl hover:border-orange-500/50 transition-colors" data-testid="card-inactive">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-1 rounded-full">Churn</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Inactive Partners</p>
                  <div className="text-3xl font-bold text-white" data-testid="text-inactive-count">{inviteMetrics.inactive}</div>
                  <p className="text-xs text-gray-600 mt-2">No deals in 6 months</p>
                </CardContent>
              </Card>


              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl hover:border-amber-500/50 transition-colors" data-testid="card-xp">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
                      <Star className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">XP</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">Total XP</p>
                  <div className="text-3xl font-bold text-white">{currentXP}</div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Referral Link Card - Full width on mobile */}
              <motion.div variants={fadeInUp} className="lg:col-span-2">
                <Card className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 border-0 rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/5"></div>
                  <CardContent className="p-6 relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                        <Share2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Your Referral Link</h2>
                        <p className="text-white/70 text-sm">Share to grow your team</p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
                      <p className="text-white/60 text-xs mb-2 uppercase tracking-wide">Your unique link</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-white font-mono text-sm bg-black/20 rounded-lg px-3 py-2 truncate">
                          {referralLink}
                        </code>
                        <Button
                          size="sm"
                          onClick={() => copyToClipboard(referralLink)}
                          className={`${copied ? 'bg-green-500 hover:bg-green-600' : 'bg-white/20 hover:bg-white/30'} text-white border-0`}
                          data-testid="button-copy-link"
                        >
                          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <Button
                        onClick={() => shareVia('whatsapp')}
                        className="bg-green-500 hover:bg-green-600 text-white border-0 flex-col h-auto py-3"
                        data-testid="button-share-whatsapp"
                      >
                        <MessageCircle className="w-5 h-5 mb-1" />
                        <span className="text-xs">WhatsApp</span>
                      </Button>
                      <Button
                        onClick={() => shareVia('email')}
                        className="bg-blue-500 hover:bg-blue-600 text-white border-0 flex-col h-auto py-3"
                        data-testid="button-share-email"
                      >
                        <Mail className="w-5 h-5 mb-1" />
                        <span className="text-xs">Email</span>
                      </Button>
                      <Button
                        onClick={() => shareVia('linkedin')}
                        className="bg-[#0077b5] hover:bg-[#006699] text-white border-0 flex-col h-auto py-3"
                        data-testid="button-share-linkedin"
                      >
                        <Linkedin className="w-5 h-5 mb-1" />
                        <span className="text-xs">LinkedIn</span>
                      </Button>
                      <Button
                        onClick={() => shareVia('twitter')}
                        className="bg-black hover:bg-gray-900 text-white border-0 flex-col h-auto py-3"
                        data-testid="button-share-twitter"
                      >
                        <Twitter className="w-5 h-5 mb-1" />
                        <span className="text-xs">Twitter</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Invite Card */}
              <motion.div variants={fadeInUp}>
                <Card className="bg-gradient-to-br from-lime-400 via-green-500 to-emerald-600 border-0 rounded-2xl h-full">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
                      <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Invite by Email</h3>
                    <p className="text-white/80 text-sm mb-4 flex-1">
                      Send a direct invitation to someone you know
                    </p>

                    <form onSubmit={handleInvite} className="space-y-3">
                      <Input
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white"
                        data-testid="input-invite-email"
                      />
                      <Button
                        type="submit"
                        className="w-full bg-white text-green-600 hover:bg-white/90"
                        disabled={inviteMutation.isPending}
                        data-testid="button-send-invite"
                      >
                        {inviteMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4 mr-2" />
                        )}
                        Send Invitation
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Progression Section */}
            <motion.div variants={fadeInUp} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Partner Progression
                </h2>
                <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-400/30">
                  {nextLevel ? `${nextLevel.xp - currentXP} XP to ${nextLevel.name}` : 'Max Level!'}
                </Badge>
              </div>

              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl overflow-hidden">
                <CardContent className="p-6">
                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-medium">{currentLevel.name}</span>
                      <span className="text-gray-400 text-sm">{Math.round(progressToNext)}%</span>
                      <span className="text-gray-500">{nextLevel?.name || 'Max'}</span>
                    </div>
                    <div className="h-3 bg-[#2a3441] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressToNext}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full bg-gradient-to-r ${currentLevel.color} rounded-full`}
                      />
                    </div>
                  </div>

                  {/* Level Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {levels.map((level, index) => (
                      <div
                        key={level.name}
                        className={`relative p-4 rounded-xl text-center transition-all ${currentXP >= level.xp
                          ? `bg-gradient-to-br ${level.color} text-white shadow-lg`
                          : 'bg-[#2a3441] text-gray-500'
                          }`}
                        data-testid={`level-${level.name.toLowerCase()}`}
                      >
                        {currentXP >= level.xp && (
                          <div className="absolute -top-1 -right-1">
                            <CheckCircle className="w-5 h-5 text-white bg-green-500 rounded-full" />
                          </div>
                        )}
                        <Crown className={`w-6 h-6 mx-auto mb-2 ${currentXP >= level.xp ? 'text-white' : 'text-gray-600'}`} />
                        <p className="font-semibold text-sm">{level.name}</p>
                        <p className={`text-xs ${currentXP >= level.xp ? 'text-white/70' : 'text-gray-600'}`}>{level.xp} XP</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Commission Structure & Team List */}
            <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Commission Structure */}
              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-pink-400" />
                    Commission Structure
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-lime-500/10 to-green-500/10 rounded-xl border border-lime-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-lime-400 to-green-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold">L1</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">Direct Referrals</p>
                          <p className="text-gray-500 text-xs">Your personal referrals</p>
                        </div>
                      </div>
                      <Badge className="bg-lime-500 text-white text-lg px-4 py-1">60%</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold">L2</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">Team Override</p>
                          <p className="text-gray-500 text-xs">Your team's referrals</p>
                        </div>
                      </div>
                      <Badge className="bg-purple-500 text-white text-lg px-4 py-1">20%</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold">L3</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">Extended Network</p>
                          <p className="text-gray-500 text-xs">Third-level connections</p>
                        </div>
                      </div>
                      <Badge className="bg-cyan-500 text-white text-lg px-4 py-1">10%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Members List */}
              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      Recent Team Members
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefresh}
                      className="text-gray-400 hover:text-white"
                      data-testid="button-refresh-team"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {isLoadingReferrals ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                    </div>
                  ) : (teamReferrals && teamReferrals.length > 0) ? (
                    <div className="space-y-3">
                      {teamReferrals.slice(0, 5).map((member: any, index: number) => (
                        <div
                          key={member.id || index}
                          className="flex items-center justify-between p-3 bg-[#2a3441] rounded-xl hover:bg-[#323d4d] transition-colors"
                          data-testid={`team-member-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-white font-medium">{member.name || 'New Member'}</p>
                              <p className="text-gray-500 text-xs">{member.email}</p>
                            </div>
                          </div>
                          <Badge className={`${member.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {member.status || 'pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-[#2a3441] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-gray-600" />
                      </div>
                      <p className="text-gray-400 mb-2">No team members yet</p>
                      <p className="text-gray-600 text-sm mb-4">Share your referral link to start building your team</p>
                      <Button
                        onClick={() => copyToClipboard(referralLink)}
                        className="bg-purple-500 hover:bg-purple-600"
                        data-testid="button-share-empty-state"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share Link
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* How It Works Section */}
            <motion.div variants={fadeInUp}>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-cyan-400" />
                How Team Building Works
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/20 rounded-2xl hover:scale-[1.02] transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">1</span>
                    </div>
                    <h3 className="text-white font-semibold mb-2">Share Your Link</h3>
                    <p className="text-gray-400 text-sm">Share your unique referral link with colleagues and contacts</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20 rounded-2xl hover:scale-[1.02] transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">2</span>
                    </div>
                    <h3 className="text-white font-semibold mb-2">They Sign Up</h3>
                    <p className="text-gray-400 text-sm">When they register using your link, they join your team</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20 rounded-2xl hover:scale-[1.02] transition-transform">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">3</span>
                    </div>
                    <h3 className="text-white font-semibold mb-2">Earn Together</h3>
                    <p className="text-gray-400 text-sm">Earn commissions from their deals and grow together</p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
