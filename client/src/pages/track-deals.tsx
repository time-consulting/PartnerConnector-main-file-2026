import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  TrendingUp,
  Clock,
  CheckCircle,
  Eye,
  Building,
  FileText,
  Mail,
  Send,
  FileCheck,
  FileUp,
  CreditCard,
  XCircle,
  DollarSign,
  Banknote,
  Filter,
  Bell
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import UnifiedDealModal from "@/components/unified-deal-modal";
import { Link } from "wouter";
import { format } from "date-fns";
import { STAGE_CONFIG, PRODUCT_TYPES, PRODUCT_CONFIG, PARTNER_TAB_CONFIG, type DealStage } from "@shared/dealWorkflow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TAB_ICONS: Record<string, any> = {
  all: FileText,
  submitted: Send,
  quote_received: Mail,
  application_submitted: FileCheck,
  in_progress: Clock,
  approved: CheckCircle,
  live: CreditCard,
  complete: CheckCircle,
  declined: XCircle,
};

const STAGE_ICONS: Record<string, any> = {
  submitted: Send,
  quote_request_received: FileText,
  quote_sent: Mail,
  quote_approved: CheckCircle,
  signup_submitted: FileCheck,
  agreement_sent: FileCheck,
  signed_awaiting_docs: FileUp,
  under_review: Clock,
  approved: CheckCircle,
  live_confirm_ltr: CreditCard,
  invoice_received: Banknote,
  completed: CheckCircle,
  declined: XCircle,
};

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: any }> = Object.fromEntries(
  Object.entries(STAGE_CONFIG).map(([id, config]) => [
    id,
    {
      label: config.partnerLabel,
      color: `${config.bgColor.replace('bg-', 'bg-').replace('/30', '/20')} ${config.iconColor} ${config.borderColor}`,
      icon: STAGE_ICONS[id] || FileText,
    },
  ])
);

const IN_PROGRESS_STAGES = ['agreement_sent', 'signed_awaiting_docs', 'under_review'];
const STAGE_NOTIFICATIONS: Record<string, { message: string; bgColor: string; textColor: string }> = {
  agreement_sent: { message: 'Application Sent', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' },
  signed_awaiting_docs: { message: 'Awaiting Documents', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' },
  under_review: { message: 'Under Review', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400' },
};

export default function TrackDeals() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [productFilter, setProductFilter] = useState<string>("all");

  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ["/api/deals/with-quotes", productFilter],
    queryFn: async () => {
      const params = productFilter !== 'all' ? `?productType=${productFilter}` : '';
      const res = await fetch(`/api/deals/with-quotes${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const filteredDeals = deals.filter((deal: any) => {
    const matchesSearch = !searchTerm ||
      deal?.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal?.businessEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getDealsForTab = (tabId: string) => {
    const tabConfig = PARTNER_TAB_CONFIG.find(t => t.id === tabId);
    if (!tabConfig) return filteredDeals;

    if (tabId === 'all') return filteredDeals;

    if (tabConfig.requiresSignupCompleted) {
      return filteredDeals.filter((deal: any) =>
        deal.signupCompletedAt && tabConfig.stages.includes(deal.dealStage)
      );
    }

    return filteredDeals.filter((deal: any) => tabConfig.stages.includes(deal.dealStage));
  };

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Please log in to view your deals.</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
        <div className="p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-primary text-sm font-medium tracking-wide uppercase mb-2">Deal Pipeline</p>
            <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="page-title-track-deals">Track Deals</h1>
            <p className="text-muted-foreground mb-4">Monitor progress and watch your commissions grow</p>

            <div className="flex flex-wrap items-center gap-4">
              {deals.length > 0 && (
                <div className="relative max-w-md flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by business name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 py-2 bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                    data-testid="input-search-deals"
                  />
                </div>
              )}
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-48 bg-card border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {PRODUCT_TYPES.map(pt => (
                    <SelectItem key={pt} value={pt}>{PRODUCT_CONFIG[pt].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="rocket-card p-5">
              <div className="rocket-icon-box mb-4">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-primary font-semibold mb-1">Total Deals</h3>
              <p className="text-muted-foreground text-sm mb-2">All time submissions</p>
              <div className="text-3xl font-bold text-foreground" data-testid="stat-total-deals">{deals.length}</div>
            </div>

            <div className="rocket-card p-5">
              <div className="rocket-icon-box mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-primary font-semibold mb-1">In Progress</h3>
              <p className="text-muted-foreground text-sm mb-2">Active deals</p>
              <div className="text-3xl font-bold text-foreground" data-testid="stat-in-progress-deals">
                {deals.filter((r: any) => !['live_confirm_ltr', 'declined'].includes(r.dealStage)).length}
              </div>
            </div>

            <div className="rocket-card p-5">
              <div className="rocket-icon-box mb-4">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-primary font-semibold mb-1">Live Deals</h3>
              <p className="text-muted-foreground text-sm mb-2">Successfully live</p>
              <div className="text-3xl font-bold text-foreground" data-testid="stat-live-deals">
                {deals.filter((r: any) => r.dealStage === 'live_confirm_ltr').length}
              </div>
            </div>

            <div className="rocket-card p-5">
              <div className="rocket-icon-box mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-primary font-semibold mb-1">Success Rate</h3>
              <p className="text-muted-foreground text-sm mb-2">Conversion rate</p>
              <div className="text-3xl font-bold text-foreground" data-testid="stat-success-rate">
                {deals.length > 0 ? Math.round((deals.filter((r: any) => r.dealStage === 'live_confirm_ltr').length / deals.length) * 100) : 0}%
              </div>
            </div>
          </div>

          {dealsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : deals.length === 0 ? (
            <div className="rocket-card p-12 text-center">
              <div className="rocket-icon-box mx-auto mb-6" style={{ width: '80px', height: '80px' }}>
                <Building className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">No deals found</h3>
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                Ready to start earning? Submit your first deals and begin building your commission income
              </p>
              <Link href="/submit-deal">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-lg font-semibold rounded-xl">
                  Submit Your First Deal
                </Button>
              </Link>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="flex w-full mb-6 h-auto bg-card border border-border rounded-lg overflow-x-auto">
                {PARTNER_TAB_CONFIG.map((tab) => {
                  const TabIcon = TAB_ICONS[tab.id] || FileText;
                  const tabDeals = getDealsForTab(tab.id);

                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex-1 flex-col h-auto py-3 px-2 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      data-testid={`tab-${tab.id}`}
                    >
                      <TabIcon className="h-5 w-5 mb-1" />
                      <span className="text-xs font-medium">{tab.label}</span>
                      {tabDeals.length > 0 && (
                        <Badge className="mt-1 h-5 min-w-5 px-1 text-xs bg-primary/20 text-primary" variant="secondary">
                          {tabDeals.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {PARTNER_TAB_CONFIG.map((tab) => {
                const tabDeals = getDealsForTab(tab.id);

                return (
                  <TabsContent key={tab.id} value={tab.id}>
                    {tabDeals.length === 0 ? (
                      <div className="rocket-card p-12 text-center border-dashed">
                        <div className="rocket-icon-box mx-auto mb-4" style={{ width: '48px', height: '48px' }}>
                          <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {tab.id === 'all' ? 'No deals found' : `No ${tab.label.toLowerCase()}`}
                        </h3>
                        <p className="text-muted-foreground">
                          {tab.id === 'all' ? 'Submit your first deal to get started' : 'Deals at this stage will appear here'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tabDeals.map((deal: any) => {
                          const statusConfig = STATUS_DISPLAY[deal.dealStage] || STATUS_DISPLAY.quote_request_received;
                          const Icon = statusConfig.icon;

                          return (
                            <div
                              key={deal.id}
                              className="rocket-card p-5 cursor-pointer hover:border-primary/50 transition-all relative"
                              onClick={() => setSelectedDeal(deal)}
                              data-testid={`card-deal-${deal.id}`}
                            >
                              {IN_PROGRESS_STAGES.includes(deal.dealStage) && STAGE_NOTIFICATIONS[deal.dealStage] && (
                                <div className={`absolute -top-2 -right-2 ${STAGE_NOTIFICATIONS[deal.dealStage].bgColor} ${STAGE_NOTIFICATIONS[deal.dealStage].textColor} border border-current/30 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 shadow-lg`}>
                                  <Bell className="h-3 w-3" />
                                  {STAGE_NOTIFICATIONS[deal.dealStage].message}
                                </div>
                              )}
                              <div className="pb-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h3 className="text-xl font-bold text-foreground mb-1">
                                      {deal.businessName}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{deal.businessEmail}</p>
                                  </div>
                                  <Icon className="h-5 w-5 text-primary" />
                                </div>
                                <Badge className={`${statusConfig.color} border rounded-full px-3 py-1 text-xs font-medium`}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="pt-3 border-t border-border mt-3">
                                {deal.totalAmount && (
                                  <div className="mb-3">
                                    <p className="text-sm text-muted-foreground">Monthly Cost</p>
                                    <p className="text-2xl font-bold text-primary">
                                      £{parseFloat(deal.totalAmount).toLocaleString()}
                                    </p>
                                  </div>
                                )}
                                {deal.estimatedMonthlySaving && (
                                  <div className="mb-3">
                                    <p className="text-sm text-muted-foreground">Est. Monthly Savings</p>
                                    <p className="text-lg font-bold text-green-400">
                                      £{parseFloat(deal.estimatedMonthlySaving).toFixed(2)}
                                    </p>
                                  </div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                  <p>Submitted: {format(new Date(deal.submittedAt), "MMM dd, yyyy")}</p>
                                  {deal.monthlyVolume && (
                                    <p>Volume: {deal.monthlyVolume}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </div>

      <UnifiedDealModal
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        deal={selectedDeal}
        viewMode="partner"
      />
    </div>
  );
}
