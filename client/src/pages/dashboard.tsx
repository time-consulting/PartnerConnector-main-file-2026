import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/sidebar";
import {
  CreditCard,
  DollarSign,
  Bot,
  Monitor,
  Globe,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  ArrowRight,
  UserPlus,
  Target,
  Plus,
  Copy,
  CheckCircle,
  Loader2,
  MessageSquare
} from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated,
  });

  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ["/api/deals/with-quotes"],
    enabled: isAuthenticated,
  });

  // Unread message count for notification
  const { data: unreadData } = useQuery({
    queryKey: ["/api/user/unread-count"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const unreadMsgCount = (unreadData as any)?.unreadCount || 0;

  /*
  // MOCK TEAM DATA
  const teamData = { teamMembers: [] };
  const teamLoading = false;
  */

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ["/api/team-analytics"],
    enabled: isAuthenticated,
  });

  const teamMembers = teamData?.teamMembers || [];
  const dealsCount = deals.length || 0;
  const liveDeals = deals.filter((d: any) => d.dealStage === 'live_confirm_ltr' || d.dealStage === 'completed').length;
  const conversionRate = dealsCount > 0 ? Math.round((liveDeals / dealsCount) * 100) : 0;

  const products = [
    {
      id: 1,
      name: "Card Payments",
      icon: CreditCard,
      description: "Accept card payments with competitive rates"
    },
    {
      id: 2,
      name: "Business Funding",
      icon: DollarSign,
      description: "Fast business loans and funding solutions"
    },
    {
      id: 3,
      name: "AI Automation",
      icon: Bot,
      description: "Automate workflows with AI technology"
    },
    {
      id: 4,
      name: "EPOS",
      icon: Monitor,
      description: "Modern point of sale systems"
    },
    {
      id: 5,
      name: "Websites",
      icon: Globe,
      description: "Professional website design and hosting"
    },
    {
      id: 6,
      name: "Restaurant Booking",
      icon: Calendar,
      description: "Table reservation management software"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />

      <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-2">Partner Dashboard</p>
            <h1 className="text-3xl font-bold text-white mb-1">
              Welcome back, {user?.firstName || 'Partner'}
            </h1>
            <p className="text-gray-500">Manage your referrals and track your commissions</p>
          </div>

          {/* Stats Overview Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rocket-card p-5" data-testid="card-deals-submitted">
              <div className="rocket-icon-box mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-cyan-400 font-semibold mb-1">Deals Submitted</h3>
              <p className="text-gray-500 text-sm mb-2">Your total referrals</p>
              <div className="text-3xl font-bold text-white" data-testid="text-deals-count">
                {dealsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : dealsCount}
              </div>
            </div>

            <div className="rocket-card p-5" data-testid="card-team-members">
              <div className="rocket-icon-box mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-cyan-400 font-semibold mb-1">Team Members</h3>
              <p className="text-gray-500 text-sm mb-2">Partners in your network</p>
              <div className="text-3xl font-bold text-white" data-testid="text-team-count">
                {teamLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : teamMembers.length}
              </div>
            </div>

            <div className="rocket-card p-5" data-testid="card-commission">
              <div className="rocket-icon-box mb-4">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-cyan-400 font-semibold mb-1">Commission</h3>
              <p className="text-gray-500 text-sm mb-2">Total earnings</p>
              <div className="text-3xl font-bold text-white" data-testid="text-commission-amount">
                {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `£${(stats?.totalValueEarned || 0).toLocaleString()}`}
              </div>
            </div>

            <div className="rocket-card p-5" data-testid="card-conversion">
              <div className="rocket-icon-box mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-cyan-400 font-semibold mb-1">Conversion Rate</h3>
              <p className="text-gray-500 text-sm mb-2">Deal success rate</p>
              <div className="text-3xl font-bold text-white">
                {dealsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${conversionRate}%`}
              </div>
            </div>
          </div>

          {/* Messages Notification Banner */}
          {unreadMsgCount > 0 && (
            <Link href="/messages">
              <div className="rocket-card p-4 mb-8 cursor-pointer border border-cyan-500/30 hover:border-cyan-400/50 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-400/20 rounded-lg flex items-center justify-center relative">
                      <MessageSquare className="w-5 h-5 text-cyan-400" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadMsgCount}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">You have {unreadMsgCount} new message{unreadMsgCount !== 1 ? 's' : ''}</p>
                      <p className="text-gray-500 text-sm">Click to view your conversations with Support</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Products Section - Takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Products</h2>
                <Link href="/submit-deal">
                  <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10" data-testid="button-view-all-products">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="rocket-card p-5 cursor-pointer"
                    data-testid={`card-product-${product.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="rocket-icon-box mb-4">
                      <product.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-white mb-1">{product.name}</h3>
                    <p className="text-gray-500 text-sm">{product.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Team Member Section */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Grow Your Team</h2>
              <div className="rocket-card p-6">
                <div className="rocket-icon-box mb-4">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold mb-2">Invite Partners</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Invite partners to join your network and earn more commissions together.
                </p>

                <div className="bg-[hsl(200,18%,8%)] border border-[hsl(174,40%,18%)] rounded-lg p-4 mb-4">
                  <p className="text-gray-500 text-xs mb-2">Your Referral Code</p>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-mono font-bold">PARTNER{user?.id || '123'}</span>
                    <Button size="sm" variant="ghost" className="text-cyan-400 hover:bg-cyan-400/10" data-testid="button-copy-code">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Link href="/team-management">
                  <Button className="w-full bg-cyan-400 text-[hsl(200,20%,6%)] hover:bg-cyan-300 font-semibold rounded-lg h-11" data-testid="button-add-team">
                    <Plus className="w-5 h-5 mr-2" />
                    Add New Member
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Team Overview & Quick Actions Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Overview */}
            <div className="rocket-card">
              <div className="p-5 border-b border-[hsl(174,40%,18%)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Team Overview</h3>
                  <Link href="/team-management">
                    <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10" data-testid="button-view-team">
                      View All
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {teamLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center p-6">
                    <Users className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No team members yet</p>
                    <p className="text-gray-600 text-xs">Invite partners to grow your network</p>
                  </div>
                ) : (
                  teamMembers.slice(0, 3).map((member: any, index: number) => (
                    <div key={member.id || index} className="flex items-center justify-between p-3 bg-[hsl(200,18%,8%)] rounded-lg border border-[hsl(174,40%,15%)]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[hsl(200,15%,15%)] border border-[hsl(174,40%,20%)] rounded-full flex items-center justify-center text-cyan-400 font-semibold">
                          {(member.firstName || member.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{member.firstName || member.name || 'Unknown'} {member.lastName || ''}</p>
                          <p className="text-gray-500 text-xs">{member.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{member.dealsCount || 0}</p>
                        <p className="text-gray-500 text-xs">Deals</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/submit-deal">
                  <div className="rocket-card p-5 cursor-pointer h-full">
                    <div className="rocket-icon-box mb-4">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-semibold mb-1">Submit Deal</h3>
                    <p className="text-gray-500 text-sm">Submit a new business deal</p>
                  </div>
                </Link>

                <Link href="/track-deals">
                  <div className="rocket-card p-5 cursor-pointer h-full">
                    <div className="rocket-icon-box mb-4">
                      <Target className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-semibold mb-1">Track Deals</h3>
                    <p className="text-gray-500 text-sm">Monitor your deal progress</p>
                  </div>
                </Link>

                <Link href="/commissions">
                  <div className="rocket-card p-5 cursor-pointer h-full">
                    <div className="rocket-icon-box mb-4">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-semibold mb-1">Commissions</h3>
                    <p className="text-gray-500 text-sm">View your earnings</p>
                  </div>
                </Link>

                <Link href="/quotes">
                  <div className="rocket-card p-5 cursor-pointer h-full">
                    <div className="rocket-icon-box mb-4">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-semibold mb-1">Quotes</h3>
                    <p className="text-gray-500 text-sm">Manage client quotes</p>
                  </div>
                </Link>

                <Link href="/messages">
                  <div className="rocket-card p-5 cursor-pointer h-full relative">
                    <div className="rocket-icon-box mb-4">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-semibold mb-1">Messages</h3>
                    <p className="text-gray-500 text-sm">View support messages</p>
                    {unreadMsgCount > 0 && (
                      <span className="absolute top-3 right-3 w-6 h-6 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadMsgCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
