import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/sidebar";
import MlmVisualization from "@/components/mlm-visualization";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  Target,
  Settings,
  BarChart3,
  FileText,
  DollarSign,
  Eye,
  Network,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function AdminBackendPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch all users for backend management
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Fetch notification counts
  const { data: notificationData } = useQuery({
    queryKey: ["/api/admin/notifications"],
  });

  const notificationCounts = notificationData || {
    submissions: 0,
    signups: 0,
    pipeline: 0,
    messages: 0,
    completedDeals: 0,
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-0 md:ml-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <p className="text-destructive font-semibold">Access Denied: Admin privileges required</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-0 md:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin")}
              className="gap-2 mb-4"
              data-testid="button-back-to-admin"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title-admin-backend">
              Backend Management
            </h1>
            <p className="text-muted-foreground mt-2">
              System settings, user management, and analytics
            </p>
          </div>

          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="users" data-testid="tab-backend-users" className="gap-2">
                <Users className="h-4 w-4" />
                <span>Users</span>
              </TabsTrigger>
              <TabsTrigger value="mlm" data-testid="tab-backend-mlm" className="gap-2">
                <Target className="h-4 w-4" />
                <span>MLM Network</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-backend-analytics" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span>Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-backend-settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">User Management</h3>
                <div className="grid gap-4">
                  {allUsers.map((u: any) => (
                    <UserCard key={u.id} user={u} />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mlm">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">MLM Network Visualization</h3>
                <MlmVisualization />
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsTab />
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">System Settings</h3>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-gray-600">System settings and configuration options will appear here.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function UserCard({ user }: { user: any }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDetailModal, setShowDetailModal] = useState(false);

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/impersonate/${userId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to impersonate user');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Impersonation Started",
        description: data.message,
      });

      // Invalidate auth queries and redirect to dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Impersonation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card className="border-2 hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-semibold">{user.firstName} {user.lastName}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
              {user.company && <p className="text-xs text-gray-500">{user.company}</p>}
              {user.partnerId && (
                <p className="text-xs text-gray-500 mt-1">
                  Partner ID: {user.partnerId}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                {user.isAdmin && <Badge className="bg-purple-500">Admin</Badge>}
                {user.emailVerified && <Badge variant="outline">Verified</Badge>}
                {user.hasCompletedOnboarding && <Badge variant="secondary">Onboarded</Badge>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetailModal(true)}
                  className="gap-2"
                >
                  <Network className="h-4 w-4" />
                  Details
                </Button>
                {!user.isAdmin && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => impersonateMutation.mutate(user.id)}
                    disabled={impersonateMutation.isPending}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View as User
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {user.firstName} {user.lastName}
            </DialogTitle>
            <DialogDescription>
              User details, network, and activity
            </DialogDescription>
          </DialogHeader>
          <UserDetailView userId={user.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserDetailView({ userId }: { userId: string }) {
  const { data: userDetails, isLoading } = useQuery({
    queryKey: [`/api/admin/user-details/${userId}`],
  });

  const { data: networkData } = useQuery({
    queryKey: [`/api/admin/mlm-personal-tree/${userId}`],
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading user details...</div>;
  }

  if (!userDetails) {
    return <div className="p-8 text-center text-red-600">Failed to load user details</div>;
  }

  const { user, referrals, totalCommissions } = userDetails;

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="network">Network</TabsTrigger>
        <TabsTrigger value="submissions">Submissions</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-sm text-gray-600 mb-1">Email</h4>
            <p>{user.email}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-600 mb-1">Company</h4>
            <p>{user.company || 'N/A'}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-600 mb-1">Profession</h4>
            <p>{user.profession || 'N/A'}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-600 mb-1">Partner ID</h4>
            <p>{user.partnerId || 'N/A'}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-600 mb-1">Total Commissions</h4>
            <p className="text-lg font-bold text-green-600">
              £{totalCommissions?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-gray-600 mb-1">Total Deals</h4>
            <p className="text-lg font-bold">{referrals?.length || 0}</p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="network" className="space-y-4">
        {networkData ? (
          <div className="space-y-4">
            {networkData.upline && networkData.upline.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Upline Chain</h4>
                <div className="space-y-2">
                  {networkData.upline.map((parent: any, idx: number) => (
                    <Card key={parent.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{parent.name}</p>
                          <p className="text-sm text-gray-600">Level {parent.level}</p>
                        </div>
                        <Badge variant="outline">{parent.partnerId}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {networkData.downline && networkData.downline.children && networkData.downline.children.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Downline ({networkData.downline.children.length} direct recruits)</h4>
                <div className="space-y-2">
                  {networkData.downline.children.map((child: any) => (
                    <Card key={child.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-gray-600">
                            {child.totalDeals} deals • £{child.totalCommissions?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <Badge variant="outline">{child.partnerId}</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {(!networkData.upline || networkData.upline.length === 0) &&
              (!networkData.downline?.children || networkData.downline.children.length === 0) && (
                <p className="text-center text-gray-500 py-8">
                  No network connections found
                </p>
              )}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Loading network data...</p>
        )}
      </TabsContent>

      <TabsContent value="submissions" className="space-y-4">
        {referrals && referrals.length > 0 ? (
          <div className="space-y-2">
            {referrals.map((deal: any) => (
              <Card key={deal.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{deal.businessName}</p>
                    <p className="text-sm text-gray-600">
                      {deal.productType} • {deal.status}
                    </p>
                  </div>
                  <div className="text-right">
                    {deal.actualCommission && (
                      <p className="font-semibold text-green-600">
                        £{parseFloat(deal.actualCommission).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(deal.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No submissions found</p>
        )}
      </TabsContent>
    </Tabs>
  );
}

function AnalyticsTab() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/admin/analytics'],
  });

  const { data: userStats } = useQuery({
    queryKey: ['/api/admin/user-stats'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-red-600">
        Failed to load analytics data
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">User Growth & Network Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Total Users</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{analytics.totalUsers}</p>
                </div>
                <Users className="h-10 w-10 text-blue-600 opacity-75" />
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-blue-700">{analytics.activeUsers} active ({analytics.activationRate}%)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Invites Sent</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">{analytics.invitesSent}</p>
                </div>
                <UserPlus className="h-10 w-10 text-green-600 opacity-75" />
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-green-700">{analytics.networkGrowthRate}% via network</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Users with Team</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{analytics.usersWithTeam}</p>
                </div>
                <Target className="h-10 w-10 text-purple-600 opacity-75" />
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-purple-700">
                  {analytics.totalUsers > 0 ? Math.round((analytics.usersWithTeam / analytics.totalUsers) * 100) : 0}% of users
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700 font-medium">Extended Network</p>
                  <p className="text-3xl font-bold text-orange-900 mt-1">{analytics.usersWithExtendedNetwork}</p>
                </div>
                <Network className="h-10 w-10 text-orange-600 opacity-75" />
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-orange-700">Multi-level growth</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Deal Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Total Deals</p>
                <FileText className="h-6 w-6 text-gray-500" />
              </div>
              <p className="text-2xl font-bold">{analytics.totalDeals}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Paid Deals</p>
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">{analytics.paidDeals}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-medium">Conversion Rate</p>
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {analytics.totalDeals > 0 ? Math.round((analytics.paidDeals / analytics.totalDeals) * 100) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Time to Value Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg. Time to First Submission</p>
                  <p className="text-3xl font-bold text-gray-900">{analytics.avgTimeToFirstSubmission}</p>
                  <p className="text-sm text-gray-500">days</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                How quickly users submit their first deal after joining
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg. Time to First Payment</p>
                  <p className="text-3xl font-bold text-gray-900">{analytics.avgTimeToFirstPayment}</p>
                  <p className="text-sm text-gray-500">days</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                How quickly users earn their first commission
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Top Deal Sources</h3>
        <Card>
          <CardContent className="p-6">
            {analytics.topDealSources && analytics.topDealSources.length > 0 ? (
              <div className="space-y-3">
                {analytics.topDealSources.map((source: any, index: number) => (
                  <div key={source.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{source.userName}</p>
                        <p className="text-xs text-gray-500">{source.userId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{source.dealCount}</p>
                      <p className="text-xs text-gray-500">deals</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No deal data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform-Wide User Engagement & Churn Tracking */}
      {userStats && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Platform-Wide User Engagement & Churn</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-700 font-medium">Total Users</p>
                    <p className="text-3xl font-bold text-indigo-900 mt-1">{userStats.totalUsers}</p>
                  </div>
                  <Users className="h-10 w-10 text-indigo-600 opacity-75" />
                </div>
                <div className="mt-3">
                  <p className="text-xs text-indigo-700">All registered users</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 font-medium">Active Users</p>
                    <p className="text-3xl font-bold text-green-900 mt-1">{userStats.active}</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-600 opacity-75" />
                </div>
                <div className="mt-3">
                  <p className="text-xs text-green-700">
                    {userStats.totalUsers > 0 ? ((userStats.active / userStats.totalUsers) * 100).toFixed(1) : 0}% - Approved deals in last 6 months
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700 font-medium">Inactive Users</p>
                    <p className="text-3xl font-bold text-orange-900 mt-1">{userStats.inactive}</p>
                  </div>
                  <RefreshCw className="h-10 w-10 text-orange-600 opacity-75" />
                </div>
                <div className="mt-3">
                  <p className="text-xs text-orange-700">
                    {userStats.totalUsers > 0 ? ((userStats.inactive / userStats.totalUsers) * 100).toFixed(1) : 0}% - Churned (no deals in 6 months)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 font-medium">Registered Only</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{userStats.registered}</p>
                  </div>
                  <UserPlus className="h-10 w-10 text-gray-600 opacity-75" />
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-700">
                    {userStats.totalUsers > 0 ? ((userStats.registered / userStats.totalUsers) * 100).toFixed(1) : 0}% - Never had approved deals
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
