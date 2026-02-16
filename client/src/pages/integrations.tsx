import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { SiQuickbooks } from "react-icons/si";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

interface Integration {
  id: string;
  provider: string;
  companyName?: string;
  isConnected: boolean;
  lastSyncAt?: string;
  syncStatus: string;
  syncError?: string;
}

const integrationProviders = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Sync contacts and invoices with QuickBooks Online',
    icon: SiQuickbooks,
    color: 'from-green-500 to-emerald-600',
    iconBg: 'bg-green-500',
    features: ['Contact sync', 'Invoice creation', 'Payment tracking'],
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Connect your Xero account for seamless accounting',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 16.894l-2.12-2.12L12 18.547l-3.774-3.773-2.12 2.12L12 22.787l5.894-5.893zM12 1.213l5.894 5.893-2.12 2.12L12 5.453 8.226 9.226l-2.12-2.12L12 1.213z" />
      </svg>
    ),
    color: 'from-cyan-500 to-blue-600',
    iconBg: 'bg-[#13B5EA]',
    features: ['Contact sync', 'Invoice sync', 'Bank reconciliation'],
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Integrate with Sage accounting for UK businesses',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
    color: 'from-emerald-500 to-green-600',
    iconBg: 'bg-emerald-600',
    features: ['Contact sync', 'Invoice export', 'Reports'],
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Cloud accounting made simple with FreshBooks',
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    color: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-[#0075DD]',
    features: ['Client management', 'Invoicing', 'Time tracking'],
  },
];

export default function Integrations() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const queryClient = useQueryClient();

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
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: integrations = [], isLoading: isLoadingIntegrations } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    enabled: isAuthenticated,
  });

  const connectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest('POST', `/api/integrations/${provider}/connect`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: () => {
      toast({
        title: "Connection Error",
        description: "Failed to initiate connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest('POST', `/api/integrations/${provider}/disconnect`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: "Disconnected",
        description: "Integration has been disconnected successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect integration.",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await apiRequest('POST', `/api/integrations/${provider}/sync`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: "Sync Started",
        description: "Your data is being synchronized.",
      });
    },
    onError: () => {
      toast({
        title: "Sync Error",
        description: "Failed to start sync. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getIntegrationStatus = (provider: string) => {
    return integrations.find(i => i.provider === provider);
  };

  const formatLastSync = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading integrations...</p>
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
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Integrations</h1>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Accounting
                </Badge>
              </div>
              <p className="text-gray-500">Connect your accounting software to sync contacts, invoices, and payments</p>
            </motion.div>

            {/* Info Card */}
            <motion.div variants={fadeInUp} className="mb-8">
              <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30 rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Link2 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">Sync Your Accounting Data</h3>
                      <p className="text-gray-400 text-sm">
                        Connect your accounting software to automatically sync client contacts, create invoices for commissions, and keep your records up to date. All data is securely encrypted.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Integration Cards */}
            <motion.div variants={fadeInUp}>
              <h2 className="text-xl font-semibold text-white mb-4">Available Integrations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {integrationProviders.map((provider) => {
                  const status = getIntegrationStatus(provider.id);
                  const isConnected = status?.isConnected || false;
                  const Icon = provider.icon;

                  return (
                    <Card
                      key={provider.id}
                      className="bg-[#1a1f26] border-[#2a3441] rounded-2xl overflow-hidden hover:border-[#3a4451] transition-colors"
                      data-testid={`integration-card-${provider.id}`}
                    >
                      <CardContent className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 ${provider.iconBg} rounded-xl flex items-center justify-center`}>
                              <Icon />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                              <p className="text-gray-500 text-sm">{provider.description}</p>
                            </div>
                          </div>
                          {isConnected ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-400/30">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-500/20 text-gray-400 border-gray-400/30">
                              Not Connected
                            </Badge>
                          )}
                        </div>

                        {/* Connected Status Details */}
                        {isConnected && status && (
                          <div className="bg-[#2a3441] rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400 text-sm">Connected Account</span>
                              <span className="text-white text-sm font-medium">{status.companyName || 'My Company'}</span>
                            </div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400 text-sm">Last Sync</span>
                              <span className="text-white text-sm">
                                {status.lastSyncAt ? formatLastSync(status.lastSyncAt) : 'Never'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400 text-sm">Status</span>
                              <div className="flex items-center gap-1">
                                {status.syncStatus === 'success' && (
                                  <>
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-green-400 text-sm">Synced</span>
                                  </>
                                )}
                                {status.syncStatus === 'syncing' && (
                                  <>
                                    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                                    <span className="text-cyan-400 text-sm">Syncing...</span>
                                  </>
                                )}
                                {status.syncStatus === 'error' && (
                                  <>
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    <span className="text-red-400 text-sm">Error</span>
                                  </>
                                )}
                                {status.syncStatus === 'idle' && (
                                  <>
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-400 text-sm">Idle</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {status.syncError && (
                              <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-red-400 text-xs">{status.syncError}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Features */}
                        {!isConnected && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-2">
                              {provider.features.map((feature) => (
                                <span
                                  key={feature}
                                  className="text-xs px-2 py-1 bg-[#2a3441] text-gray-400 rounded-full"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                          {isConnected ? (
                            <>
                              <Button
                                onClick={() => syncMutation.mutate(provider.id)}
                                disabled={syncMutation.isPending || status?.syncStatus === 'syncing'}
                                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
                                data-testid={`button-sync-${provider.id}`}
                              >
                                <RefreshCw className={`w-4 h-4 mr-2 ${status?.syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                                Sync Now
                              </Button>
                              <Button
                                onClick={() => disconnectMutation.mutate(provider.id)}
                                disabled={disconnectMutation.isPending}
                                variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                                data-testid={`button-disconnect-${provider.id}`}
                              >
                                <Unlink className="w-4 h-4 mr-2" />
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button
                              onClick={() => connectMutation.mutate(provider.id)}
                              disabled={connectMutation.isPending}
                              className={`flex-1 bg-gradient-to-r ${provider.color} text-white`}
                              data-testid={`button-connect-${provider.id}`}
                            >
                              <Link2 className="w-4 h-4 mr-2" />
                              Connect {provider.name}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>

            {/* Setup Instructions */}
            <motion.div variants={fadeInUp} className="mt-8">
              <Card className="bg-[#1a1f26] border-[#2a3441] rounded-2xl">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-white font-bold">1</span>
                      </div>
                      <h4 className="text-white font-medium mb-1">Connect</h4>
                      <p className="text-gray-500 text-sm">Click connect and authorize PartnerConnector to access your accounting software</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-white font-bold">2</span>
                      </div>
                      <h4 className="text-white font-medium mb-1">Sync</h4>
                      <p className="text-gray-500 text-sm">Your contacts and deals will be automatically synced between platforms</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-lime-400 to-green-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-white font-bold">3</span>
                      </div>
                      <h4 className="text-white font-medium mb-1">Manage</h4>
                      <p className="text-gray-500 text-sm">View sync status and manage your connection from this dashboard</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* API Keys Notice */}
            <motion.div variants={fadeInUp} className="mt-6">
              <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">API Credentials Required</h3>
                      <p className="text-gray-400 text-sm">
                        To enable integrations, you'll need to configure API credentials for each provider. Contact our support team to get started with setting up your accounting integrations.
                      </p>
                      <a
                        href="/help-center"
                        className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm mt-2"
                      >
                        Learn more <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
