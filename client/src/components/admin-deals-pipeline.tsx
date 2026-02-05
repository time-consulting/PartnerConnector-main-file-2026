import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  Mail,
  Phone,
  Banknote,
  FileCheck,
  FileUp,
  CreditCard,
  Building2,
  Send,
  Globe,
  Sparkles,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import DealDetailsModal from "./deal-details-modal";
import {
  getStagesForAdmin,
  PRODUCT_TYPES,
  PRODUCT_CONFIG,
  type DealStage,
  type ProductType
} from "@shared/dealWorkflow";

const STAGE_ICONS: Record<string, any> = {
  submitted: Send,
  quote_request_received: FileText,
  quote_sent: Mail,
  quote_approved: CheckCircle,
  agreement_sent: FileCheck,
  signed_awaiting_docs: FileUp,
  approved: CheckCircle,
  live_confirm_ltr: CreditCard,
  invoice_received: Banknote,
  completed: CheckCircle,
  declined: XCircle,
};

const PIPELINE_STAGES = getStagesForAdmin().map(stage => ({
  id: stage.id,
  label: stage.adminLabel,
  description: stage.description,
  icon: STAGE_ICONS[stage.id] || FileText,
  bgColor: stage.bgColor,
  borderColor: stage.borderColor,
  badgeColor: stage.color,
  iconColor: stage.iconColor,
}));

interface Deal {
  id: string;
  dealId: string | null;
  businessName: string;
  businessEmail: string;
  businessPhone: string | null;
  dealStage: string;
  productType?: string;
  quoteDeliveryMethod?: string;
  submittedAt: string;
  actualCommission: string | null;
  estimatedCommission: string | null;
  monthlyVolume: string | null;
  currentProcessor: string | null;
  fundingAmount: string | null;
  selectedProducts: string[] | null;
  referrer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  partnerName?: string;
  partnerEmail?: string;
}

export function AdminDealsPipeline() {
  const { toast } = useToast();
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [queryMessage, setQueryMessage] = useState("");
  const [moveToStage, setMoveToStage] = useState("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [openQuoteBuilder, setOpenQuoteBuilder] = useState(false);
  const [productFilter, setProductFilter] = useState<string>("all");
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionNotes, setCommissionNotes] = useState("");
  const [existingPayment, setExistingPayment] = useState<any>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  const { data, isLoading, error } = useQuery<{ deals: Deal[] } | { referrals: Deal[] } | Deal[]>({
    queryKey: ["/api/admin/referrals", productFilter],
    queryFn: async () => {
      const params = productFilter !== 'all' ? `?productType=${productFilter}` : '';
      const res = await fetch(`/api/admin/referrals${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  // Handle multiple response formats for backwards compatibility
  const deals = Array.isArray(data)
    ? data
    : ((data as any)?.deals || (data as any)?.referrals || []);

  const moveToStageMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: string; stage: string }) => {
      // Get the stage label for the log
      const stageLabel = PIPELINE_STAGES.find(s => s.id === stage)?.label || stage;

      // Create formatted timestamp: "Stage Name - HH:MM - MMM D, YYYY"
      const now = new Date();
      const time = format(now, "HH:mm");
      const date = format(now, "MMM d, yyyy");
      const logEntry = `${stageLabel} - ${time} - ${date}`;

      console.log('📝 Sending progress log:', logEntry);

      return await apiRequest("PATCH", `/api/admin/referrals/${dealId}`, {
        dealStage: stage,
        appendProgressLog: logEntry, // This will be appended to adminNotes on backend
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      toast({
        title: "Success",
        description: "Deal moved to new stage",
      });
      setMoveDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move deal",
        variant: "destructive",
      });
    },
  });

  const sendQueryMutation = useMutation({
    mutationFn: async ({ dealId, message }: { dealId: string; message: string }) => {
      // Use the unified deal messaging system
      return await apiRequest("POST", `/api/deals/${dealId}/messages`, {
        message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Success",
        description: "Message sent to partner",
      });
      setQueryDialogOpen(false);
      setQueryMessage("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send query",
        variant: "destructive",
      });
    },
  });

  const createCommissionMutation = useMutation({
    mutationFn: async ({ dealId, grossAmount, notes }: { dealId: string; grossAmount: number; notes: string }) => {
      return await apiRequest("POST", `/api/admin/payments/create-commission`, {
        dealId,
        grossAmount,
        currency: "GBP",
        notes,
        evidenceUrl: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments/needs-approval"] });
      toast({
        title: "Commission Created",
        description: "Commission payment has been created and is pending approval.",
      });
      setCommissionDialogOpen(false);
      setCommissionAmount("");
      setCommissionNotes("");
      setSelectedDeal(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create commission payment",
        variant: "destructive",
      });
    },
  });

  const handleConfirmCommission = async (deal: Deal) => {
    setSelectedDeal(deal);
    setCommissionAmount(deal.actualCommission || deal.estimatedCommission || "");
    setExistingPayment(null);
    setCheckingPayment(true);
    setCommissionDialogOpen(true);

    try {
      const response = await fetch(`/api/admin/deals/${deal.id}/payment-status`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.hasPayment) {
          setExistingPayment(data.payment);
        }
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    } finally {
      setCheckingPayment(false);
    }
  };

  const submitCommission = () => {
    if (selectedDeal && commissionAmount) {
      const amount = parseFloat(commissionAmount.replace(/[^0-9.]/g, ""));
      if (!isNaN(amount) && amount > 0) {
        createCommissionMutation.mutate({
          dealId: selectedDeal.id,
          grossAmount: amount,
          notes: commissionNotes,
        });
      }
    }
  };

  const dealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = deals.filter((deal) => deal.dealStage === stage.id);
    return acc;
  }, {} as Record<string, Deal[]>);

  const handleMoveToStage = (deal: Deal) => {
    setSelectedDeal(deal);
    setMoveToStage(deal.dealStage || "");
    setMoveDialogOpen(true);
  };

  const confirmMoveToStage = () => {
    if (selectedDeal && moveToStage) {
      moveToStageMutation.mutate({
        dealId: selectedDeal.id,
        stage: moveToStage,
      });
    }
  };

  const handleSendQuery = () => {
    if (selectedDeal && queryMessage.trim()) {
      sendQueryMutation.mutate({
        dealId: selectedDeal.id,
        message: queryMessage,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-destructive/50">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-destructive font-semibold">Failed to load deals</p>
          <p className="text-muted-foreground text-sm mt-2">Please try refreshing the page</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Product Filter */}
      <div className="flex items-center gap-4 mb-4">
        <Label className="text-sm font-medium text-muted-foreground">Product:</Label>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-48 bg-card border-border">
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{deals.length}</div>
            <div className="text-sm text-muted-foreground">Total Deals</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{dealsByStage["quote_request_received"]?.length || 0}</div>
            <div className="text-sm text-muted-foreground">New Requests</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">{dealsByStage["signed_awaiting_docs"]?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Awaiting Docs</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-400">{dealsByStage["completed"]?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-400">{dealsByStage["declined"]?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Declined</div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Accordion */}
      <Accordion type="multiple" className="w-full space-y-3">
        {PIPELINE_STAGES.map((stage) => {
          const stageDeals = dealsByStage[stage.id] || [];
          const Icon = stage.icon;

          return (
            <AccordionItem
              key={stage.id}
              value={stage.id}
              className={`border-2 rounded-xl ${stage.bgColor} ${stage.borderColor} transition-all hover:shadow-lg`}
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline" data-testid={`accordion-${stage.id}`}>
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${stage.iconColor}`} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-foreground">{stage.label}</h3>
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                    </div>
                  </div>
                  <Badge className={`${stage.badgeColor} text-white text-sm px-3 py-1`}>
                    {stageDeals.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                {stageDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No deals in this stage</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {stageDeals.map((deal) => (
                      <Card key={deal.id} className="bg-card border-border hover:shadow-lg hover:border-primary/50 transition-all">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Building2 className="h-5 w-5 text-primary" />
                                  <h4 className="text-xl font-bold text-foreground">{deal.businessName}</h4>
                                  <Badge
                                    variant="secondary"
                                    className={`
                                      ${deal.productType === 'card_payments' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : ''}
                                      ${deal.productType === 'business_funding' ? 'bg-green-500/20 text-green-300 border-green-500/50' : ''}
                                      ${deal.productType === 'utilities' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' : ''}
                                      ${deal.productType === 'insurance' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : ''}
                                      ${deal.productType === 'custom' ? 'bg-gray-500/20 text-gray-300 border-gray-500/50' : ''}
                                      ${!deal.productType ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : ''}
                                    `}
                                  >
                                    {deal.productType === 'card_payments' && 'Card Payments'}
                                    {deal.productType === 'business_funding' && 'Funding'}
                                    {deal.productType === 'utilities' && 'Utilities'}
                                    {deal.productType === 'insurance' && 'Insurance'}
                                    {deal.productType === 'custom' && 'Custom'}
                                    {!deal.productType && 'Card Payments'}
                                  </Badge>
                                  {deal.quoteDeliveryMethod === 'email' && (
                                    <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/50">
                                      Email Quote
                                    </Badge>
                                  )}
                                </div>
                                {(deal.partnerName || deal.referrer) && (
                                  <p className="text-sm text-muted-foreground">
                                    Partner: {deal.partnerName || `${deal.referrer?.firstName} ${deal.referrer?.lastName}`}
                                  </p>
                                )}
                              </div>
                              {deal.dealId && (
                                <Badge variant="outline" className="font-mono bg-background/50 text-primary border-primary/50">
                                  {deal.dealId}
                                </Badge>
                              )}
                            </div>

                            {/* Deal Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-foreground">{deal.businessEmail}</span>
                              </div>
                              {deal.businessPhone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-foreground">{deal.businessPhone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-foreground">
                                  {format(new Date(deal.submittedAt), "MMM dd, yyyy")}
                                </span>
                              </div>
                              {deal.monthlyVolume && (
                                <div className="flex items-center gap-2">
                                  <Banknote className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-foreground">Vol: {deal.monthlyVolume}</span>
                                </div>
                              )}
                            </div>

                            {/* Commission Display */}
                            {(deal.actualCommission || deal.estimatedCommission) && (
                              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-muted-foreground">Commission</span>
                                  <span className="text-2xl font-bold text-primary">
                                    £{deal.actualCommission || deal.estimatedCommission}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2 flex-wrap">
                              {["submitted", "quote_request_received"].includes(stage.id) && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-card border-border hover:bg-secondary"
                                    onClick={() => {
                                      setSelectedDeal(deal);
                                      setOpenQuoteBuilder(false);
                                      setDetailsModalOpen(true);
                                    }}
                                    data-testid={`button-view-deal-${deal.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    onClick={() => {
                                      setSelectedDeal(deal);
                                      setOpenQuoteBuilder(true);
                                      setDetailsModalOpen(true);
                                    }}
                                    data-testid={`button-generate-quote-${deal.id}`}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Generate Quote
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    onClick={() => handleMoveToStage(deal)}
                                    data-testid={`button-select-stage-${deal.id}`}
                                  >
                                    <ArrowUpDown className="h-4 w-4 mr-2" />
                                    Select Stage
                                  </Button>
                                </>
                              )}

                              {stage.id === "quote_approved" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50 text-purple-300"
                                    onClick={() => {
                                      setSelectedDeal(deal);
                                      setDetailsModalOpen(true);
                                    }}
                                    data-testid={`button-view-signup-${deal.id}`}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Sign Up Form
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    onClick={() => handleMoveToStage(deal)}
                                    data-testid={`button-select-stage-${deal.id}`}
                                  >
                                    <ArrowUpDown className="h-4 w-4 mr-2" />
                                    Select Stage
                                  </Button>
                                </>
                              )}

                              {stage.id !== "submitted" && stage.id !== "quote_request_received" && stage.id !== "quote_approved" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-card border-border hover:bg-secondary"
                                    onClick={() => {
                                      setSelectedDeal(deal);
                                      setDetailsModalOpen(true);
                                    }}
                                    data-testid={`button-view-deal-${deal.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-card border-border hover:bg-secondary"
                                    onClick={() => {
                                      setSelectedDeal(deal);
                                      setQueryDialogOpen(true);
                                    }}
                                    data-testid={`button-query-deal-${deal.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Send Query
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                    onClick={() => handleMoveToStage(deal)}
                                    data-testid={`button-select-stage-${deal.id}`}
                                  >
                                    <ArrowUpDown className="h-4 w-4 mr-2" />
                                    Select Stage
                                  </Button>
                                  {stage.id === "live_confirm_ltr" && (
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleConfirmCommission(deal)}
                                      data-testid={`button-confirm-commission-${deal.id}`}
                                    >
                                      <Banknote className="h-4 w-4 mr-2" />
                                      Confirm Commission
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Query Dialog */}
      <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Send Query to Partner</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send a message to the partner regarding {selectedDeal?.businessName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="query-message" className="text-foreground">Message</Label>
              <Textarea
                id="query-message"
                value={queryMessage}
                onChange={(e) => setQueryMessage(e.target.value)}
                placeholder="Enter your query..."
                rows={5}
                className="bg-background border-border text-foreground"
                data-testid="input-query-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-card border-border hover:bg-secondary"
              onClick={() => {
                setQueryDialogOpen(false);
                setQueryMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSendQuery}
              disabled={!queryMessage.trim() || sendQueryMutation.isPending}
              data-testid="button-send-query"
            >
              {sendQueryMutation.isPending ? "Sending..." : "Send Query"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Stage Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Select Stage</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Move {selectedDeal?.businessName} to any stage in the pipeline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label htmlFor="target-stage" className="text-foreground font-semibold">Select Stage</Label>
              <Select value={moveToStage} onValueChange={setMoveToStage}>
                <SelectTrigger id="target-stage" className="bg-background border-border h-12" data-testid="select-target-stage">
                  <SelectValue placeholder="Select target stage" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-[400px]">
                  {PIPELINE_STAGES.map((stage) => {
                    const isCurrent = selectedDeal?.dealStage === stage.id;
                    return (
                      <SelectItem
                        key={stage.id}
                        value={stage.id}
                        className={isCurrent ? "bg-primary/20" : ""}
                      >
                        <div className="flex items-center gap-3">
                          <stage.icon className={`h-4 w-4 ${stage.iconColor}`} />
                          <span>{stage.label}</span>
                          {isCurrent && (
                            <Badge variant="outline" className="ml-2 text-xs border-primary text-primary">Current</Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {moveToStage && moveToStage !== selectedDeal?.dealStage && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Moving from <span className="font-medium text-foreground">{PIPELINE_STAGES.find(s => s.id === selectedDeal?.dealStage)?.label || 'Unknown'}</span> to{' '}
                  <span className="font-medium text-primary">{PIPELINE_STAGES.find(s => s.id === moveToStage)?.label}</span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="bg-card border-border hover:bg-secondary"
              onClick={() => setMoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={confirmMoveToStage}
              disabled={moveToStageMutation.isPending || !moveToStage || moveToStage === selectedDeal?.dealStage}
              data-testid="button-confirm-move"
            >
              {moveToStageMutation.isPending ? "Moving..." : "Move to Stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Confirmation Dialog */}
      <Dialog open={commissionDialogOpen} onOpenChange={(open) => {
        setCommissionDialogOpen(open);
        if (!open) {
          setExistingPayment(null);
          setCommissionAmount("");
          setCommissionNotes("");
        }
      }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {existingPayment ? "Commission Already Created" : "Confirm Commission"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {existingPayment
                ? `A commission payment already exists for ${selectedDeal?.businessName}`
                : `Create a commission payment for ${selectedDeal?.businessName}`
              }
            </DialogDescription>
          </DialogHeader>

          {checkingPayment ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : existingPayment ? (
            <div className="space-y-4 py-4">
              <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">Commission Created</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium text-foreground">£{existingPayment.grossAmount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={existingPayment.status === 'paid' ? 'bg-green-600' : 'bg-amber-600'}>
                    {existingPayment.status}
                  </Badge>
                </div>
                {existingPayment.notes && (
                  <div className="text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Notes: </span>
                    <span className="text-foreground">{existingPayment.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Business:</span>
                  <span className="font-medium text-foreground">{selectedDeal?.businessName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Partner:</span>
                  <span className="font-medium text-foreground">{selectedDeal?.partnerName || selectedDeal?.referrer?.firstName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated:</span>
                  <span className="font-medium text-foreground">£{selectedDeal?.estimatedCommission || "0"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-amount" className="text-foreground">Commission Amount (£)</Label>
                <Input
                  id="commission-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={commissionAmount}
                  onChange={(e) => setCommissionAmount(e.target.value)}
                  placeholder="Enter commission amount..."
                  className="bg-background border-border text-foreground"
                  data-testid="input-commission-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-notes" className="text-foreground">Notes (optional)</Label>
                <Textarea
                  id="commission-notes"
                  value={commissionNotes}
                  onChange={(e) => setCommissionNotes(e.target.value)}
                  placeholder="Add any notes about this commission..."
                  rows={3}
                  className="bg-background border-border text-foreground"
                  data-testid="input-commission-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="bg-card border-border hover:bg-secondary"
              onClick={() => setCommissionDialogOpen(false)}
            >
              {existingPayment ? "Close" : "Cancel"}
            </Button>
            {!existingPayment && !checkingPayment && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={submitCommission}
                disabled={createCommissionMutation.isPending || !commissionAmount || parseFloat(commissionAmount) <= 0}
                data-testid="button-submit-commission"
              >
                {createCommissionMutation.isPending ? "Creating..." : "Create Commission"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Details Modal with Quote Builder */}
      <DealDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedDeal(null);
          setOpenQuoteBuilder(false);
        }}
        deal={selectedDeal}
        showQuoteBuilderOnOpen={openQuoteBuilder}
      />
    </div>
  );
}
