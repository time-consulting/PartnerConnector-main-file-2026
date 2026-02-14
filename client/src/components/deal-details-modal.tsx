import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Mail, Phone, MapPin, Building2, Calendar, Banknote,
  FileText, Package, CreditCard, DollarSign, TrendingUp,
  Download, Eye, Upload, ArrowLeft, ArrowRight, ClipboardCheck, User, FileCheck, Loader2
} from "lucide-react";
import { format } from "date-fns";
import QuoteBuilder from "./quote-builder";
import FundingQuoteBuilder from "./funding-quote-builder";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: any;
  showQuoteBuilderOnOpen?: boolean;
}

// Admin Commission Creation Section - shows at LIVE stage
function AdminCommissionSection({ deal, onComplete }: { deal: any; onComplete: () => void }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [grossAmount, setGrossAmount] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [notes, setNotes] = useState("");

  const dealStage = deal.dealStage || deal.status || 'submitted';
  const isLiveStage = ['live', 'live_confirm_ltr'].includes(dealStage);

  // Check if payment already exists for this deal
  const { data: paymentStatus, isLoading } = useQuery({
    queryKey: ['/api/admin/deals', deal.id, 'payment-status'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/deals/${deal.id}/payment-status`, { credentials: 'include' });
      if (!response.ok) return { hasPayment: false };
      return response.json();
    },
    enabled: isLiveStage,
  });

  // Create commission mutation
  const createCommissionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/admin/payments/create-commission', {
        dealId: deal.id,
        grossAmount: parseFloat(grossAmount),
        currency,
        evidenceUrl: evidenceUrl || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Commission Created", description: "Commission has been sent to Payments for approval." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/deals', deal.id, 'payment-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/needs-approval'] });
      setShowForm(false);
      setGrossAmount("");
      setEvidenceUrl("");
      setNotes("");
      onComplete();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create commission. Please try again.",
        variant: "destructive"
      });
    }
  });

  if (!isLiveStage) {
    return null;
  }
  if (isLoading) {
    return <div className="flex-1 p-4 bg-slate-800 rounded text-center text-slate-400">Loading payment status...</div>;
  }

  // If payment already exists, show status
  if (paymentStatus?.hasPayment) {
    const payment = paymentStatus.payment;
    const statusLabels: Record<string, string> = {
      needs_approval: 'Pending Approval',
      approved: 'Approved',
      paid: 'Paid',
    };
    const statusColors: Record<string, string> = {
      needs_approval: 'bg-amber-600 text-white',
      approved: 'bg-blue-600 text-white',
      paid: 'bg-green-600 text-white',
    };

    return (
      <div className="flex-1 p-4 bg-slate-800/50 rounded-lg border border-teal-500/30">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-teal-400 flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Commission Created
          </h4>
          <Badge className={statusColors[payment.paymentStatus] || 'bg-slate-600 text-white'}>
            {statusLabels[payment.paymentStatus] || payment.paymentStatus}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Gross Amount</p>
            <p className="font-medium text-white text-lg">{payment.currency || 'GBP'} £{parseFloat(payment.grossAmount || payment.totalCommission).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400">Created</p>
            <p className="text-white">{payment.createdAt ? format(new Date(payment.createdAt), 'MMM d, yyyy') : 'N/A'}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">View in Payments tab for approval &amp; payout</p>
      </div>
    );
  }

  // Calculate split preview
  const grossNum = parseFloat(grossAmount) || 0;
  const splitPreview = grossNum > 0 ? [
    { label: 'Partner (60%)', amount: grossNum * 0.60 },
    { label: 'Upline L1 (20%)', amount: grossNum * 0.20 },
    { label: 'Upline L2 (10%)', amount: grossNum * 0.10 },
  ] : [];

  // Show create commission button/form
  return (
    <div className="flex-1 p-4 bg-slate-800/50 rounded-lg border border-amber-500/30">
      <div className="flex items-center gap-2 mb-3">
        <Banknote className="h-5 w-5 text-amber-400" />
        <span className="font-semibold text-amber-400">Finalise Commission</span>
        <Badge className="bg-amber-600 text-white">
          Ready
        </Badge>
      </div>

      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3"
        >
          <FileCheck className="h-4 w-4 mr-2" />
          Finalise Commission
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Gross Commission Amount *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={grossAmount}
                onChange={(e) => setGrossAmount(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 text-white px-3"
              >
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {/* Split Preview */}
          {grossNum > 0 && (
            <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
              <p className="text-xs text-slate-400 mb-2">Commission Split Preview (MLM)</p>
              <div className="space-y-1">
                {splitPreview.map((split, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-300">{split.label}</span>
                    <span className="text-teal-400 font-medium">£{split.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Evidence URL (optional)</label>
            <Input
              type="url"
              placeholder="Link to bill or statement..."
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
            <Input
              type="text"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => createCommissionMutation.mutate()}
              disabled={!grossAmount || createCommissionMutation.isPending}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {createCommissionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Create Commission
            </Button>
            <Button
              onClick={() => setShowForm(false)}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DealDetailsModal({ isOpen, onClose, deal, showQuoteBuilderOnOpen = false }: DealDetailsModalProps) {
  const { toast } = useToast();
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [isMovingForward, setIsMovingForward] = useState(false);

  // Control quote builder visibility based on modal state, prop, and deal
  // Dependencies include deal?.id to reset state when switching between deals
  useEffect(() => {
    if (!isOpen) {
      // Modal closed: always reset
      setShowQuoteBuilder(false);
      return;
    }
    // Modal is open: set state based on prop
    if (showQuoteBuilderOnOpen) {
      setShowQuoteBuilder(true);
    } else {
      setShowQuoteBuilder(false);
    }
  }, [isOpen, showQuoteBuilderOnOpen, deal?.id]);

  // Fetch signup details for this deal
  const { data: signupDetails, isLoading: signupLoading } = useQuery({
    queryKey: ['/api/admin/deals', deal?.id, 'signup-details'],
    queryFn: async () => {
      if (!deal?.id) return null;
      const response = await fetch(`/api/admin/deals/${deal.id}/signup-details`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: isOpen && !!deal?.id,
  });

  const handleQuoteCreated = (quoteId: string) => {
    // Invalidate all relevant query keys so both admin pipeline and partner views refresh
    queryClient.invalidateQueries({ queryKey: ['/api/admin/referrals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/deals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    toast({
      title: "Quote Generated",
      description: `Quote sent successfully to ${deal.businessEmail}`,
    });
    setShowQuoteBuilder(false);
    onClose();
  };

  const handleDownloadFile = (fileId: string, fileName: string) => {
    const downloadUrl = `/api/bills/${fileId}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewFile = (fileId: string) => {
    window.open(`/api/bills/${fileId}/view`, '_blank');
  };

  const handleMoveForward = async () => {
    try {
      setIsMovingForward(true);
      const response = await fetch(`/api/admin/deals/${deal.id}/move-to-agreement-sent`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to move deal forward');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/admin/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });

      toast({
        title: "Deal Moved Forward",
        description: `${deal.businessName} has been moved to "Agreement Sent" stage`,
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move deal forward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMovingForward(false);
    }
  };

  if (!deal) return null;

  // Debug: Log the dealStage to verify what we're getting
  console.log('Deal Details Modal - dealStage:', deal.dealStage, 'Deal:', deal);

  // If showing sign up form viewer, render it
  if (showSignUpForm) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSignUpForm(false)}
                data-testid="button-back-to-details"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Details
              </Button>
              <DialogTitle className="text-2xl font-bold">
                Sign Up Form for {deal.businessName}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-6 p-6 overflow-y-auto flex-1">
            {/* Quote Details Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quote Details Sent to Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deal.quote ? (
                  <>
                    {/* Transaction Rates */}
                    <div>
                      <h4 className="font-semibold mb-2">Transaction Rates</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-gray-50 rounded">
                          <label className="text-xs text-gray-600">Credit Card</label>
                          <p className="font-medium">{deal.quote.creditCardRate}%</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                          <label className="text-xs text-gray-600">Debit Card</label>
                          <p className="font-medium">{deal.quote.debitCardRate}%</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded">
                          <label className="text-xs text-gray-600">Corporate Card</label>
                          <p className="font-medium">{deal.quote.corporateCardRate}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Devices */}
                    {deal.quote.devices && deal.quote.devices.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Card Machines</h4>
                        <div className="space-y-2">
                          {deal.quote.devices.map((device: any, idx: number) => (
                            <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded flex justify-between">
                              <span>{device.type === 'dojo_go' ? 'Dojo Go' : 'Dojo Pocket'} x {device.quantity}</span>
                              <span className="font-medium">£{device.price}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Payment Type: {deal.quote.devicePaymentType === 'pay_once' ? 'Pay Once' : 'Monthly Payment'}
                        </p>
                      </div>
                    )}

                    {/* Optional Extras */}
                    <div>
                      <h4 className="font-semibold mb-2">Optional Extras</h4>
                      <div className="space-y-2">
                        {deal.quote.hardwareCare && (
                          <div className="flex items-center gap-2">
                            <Badge>Hardware Care</Badge>
                            <span className="text-sm">£5 per device/month</span>
                          </div>
                        )}
                        {deal.quote.dojoPlan && (
                          <div className="flex items-center gap-2">
                            <Badge>Dojo Plan</Badge>
                            <span className="text-sm">£11.99/month (3 months free trial)</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Settlement</Badge>
                          <span className="text-sm">{deal.quote.settlementType === '5_day' ? '5-Day' : '7-Day'} Settlement</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Costs */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      {deal.quote.oneTimeDeviceCost && (
                        <div className="p-4 bg-green-50 rounded-lg">
                          <label className="text-sm text-gray-700">One-Time Device Cost</label>
                          <p className="font-bold text-2xl text-green-700">£{deal.quote.oneTimeDeviceCost}</p>
                        </div>
                      )}
                      {deal.quote.monthlyDeviceCost && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <label className="text-sm text-gray-700">Monthly Device Cost</label>
                          <p className="font-bold text-2xl text-blue-700">£{deal.quote.monthlyDeviceCost}/mo</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 italic">No quote details available</p>
                )}
              </CardContent>
            </Card>

            {/* Customer Sign-Up Form Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Customer Sign-Up Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deal.signUpFormData ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Customer signed up on: {deal.signUpFormData.submittedAt ? format(new Date(deal.signUpFormData.submittedAt), 'PPP') : 'N/A'}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(deal.signUpFormData).map(([key, value]: [string, any]) => (
                        <div key={key}>
                          <label className="text-xs text-gray-600 capitalize">{key.replace(/_/g, ' ')}</label>
                          <p className="font-medium">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Customer has not yet completed the sign-up form</p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowSignUpForm(false)}
                variant="outline"
                className="flex-1"
              >
                Back to Details
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Check if deal has required fields for quote generation
  const canGenerateQuote = deal?.businessName && deal?.businessEmail && deal?.id;

  // If showing quote builder, render it full screen in the modal
  if (showQuoteBuilder) {
    // Defensive validation: if required fields are missing, show error instead of blank form
    if (!canGenerateQuote) {
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-destructive">
                Cannot Generate Quote
              </DialogTitle>
              <DialogDescription>
                Missing required information to generate a quote.
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-foreground mb-2">Please ensure the following fields are complete:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {!deal?.businessName && <li>Business Name</li>}
                {!deal?.businessEmail && <li>Business Email</li>}
                {!deal?.id && <li>Deal ID</li>}
              </ul>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowQuoteBuilder(false)}>
                Back to Details
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    const isFundingDeal = deal.productType === 'business_funding' ||
      (deal.selectedProducts && Array.isArray(deal.selectedProducts) && deal.selectedProducts.includes('business-funding')) ||
      deal.quoteType === 'business_funding' || deal.quoteType === 'funding_with_cards';

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuoteBuilder(false)}
                data-testid="button-back-to-details"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Details
              </Button>
              <DialogTitle className="text-2xl font-bold">
                {isFundingDeal ? 'Business Funding Quote' : 'Generate Quote'} for {deal.businessName}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {isFundingDeal ? (
              <FundingQuoteBuilder
                dealId={deal.id}
                businessName={deal.businessName}
                deal={deal}
                onQuoteCreated={handleQuoteCreated}
                onCancel={() => setShowQuoteBuilder(false)}
              />
            ) : (
              <QuoteBuilder
                dealId={deal.id}
                businessName={deal.businessName}
                onQuoteCreated={handleQuoteCreated}
                onCancel={() => setShowQuoteBuilder(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Deal Details: {deal.businessName}
          </DialogTitle>
          <DialogDescription>
            Complete information from the deals submission
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6 overflow-y-auto flex-1">
          {/* Business Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Business Name</label>
                <p className="font-medium text-lg">{deal.businessName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Business Type</label>
                <p className="font-medium">{deal.businessType?.name || "N/A"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Email</label>
                  <p className="font-medium">{deal.businessEmail}</p>
                </div>
              </div>
              {deal.businessPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Phone</label>
                    <p className="font-medium">{deal.businessPhone}</p>
                  </div>
                </div>
              )}
              {deal.businessAddress && (
                <div className="col-span-2 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Address</label>
                    <p className="font-medium">{deal.businessAddress}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <label className="text-sm text-gray-600">Submitted</label>
                  <p className="font-medium">
                    {format(new Date(deal.submittedAt), "MMMM dd, yyyy 'at' HH:mm")}
                  </p>
                </div>
              </div>
              {deal.dealId && (
                <div>
                  <label className="text-sm text-gray-600">Deal ID</label>
                  <Badge variant="outline" className="font-mono">
                    {deal.dealId}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Sign-Up Details Card - Shows when signup form has been completed */}
          {signupDetails && (
            <Card className="border-teal-500 border-2">
              <CardHeader className="bg-teal-50">
                <CardTitle className="flex items-center gap-2 text-teal-700">
                  <User className="h-5 w-5" />
                  Customer Sign-Up Information (Form Completed)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-4">
                {/* Director/Owner Details */}
                <div className="col-span-2">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Director/Owner Details</h4>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <p className="font-medium">{signupDetails.ownerFirstName} {signupDetails.ownerLastName}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <p className="font-medium">{signupDetails.ownerEmail}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Phone</label>
                  <p className="font-medium">{signupDetails.ownerPhone}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Home Address</label>
                  <p className="font-medium">{signupDetails.ownerHomeAddress}</p>
                </div>

                <Separator className="col-span-2 my-2" />

                {/* Business Details */}
                <div className="col-span-2">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Business Details</h4>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Trading Name</label>
                  <p className="font-medium">{signupDetails.tradingName}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Business Structure</label>
                  <p className="font-medium capitalize">{signupDetails.businessStructure?.replace(/_/g, ' ')}</p>
                </div>
                {signupDetails.limitedCompanyName && (
                  <div>
                    <label className="text-sm text-gray-600">Limited Company Name</label>
                    <p className="font-medium">{signupDetails.limitedCompanyName}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-sm text-gray-600">Trading Address</label>
                  <p className="font-medium">{signupDetails.tradingAddress}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-gray-600">Business Description</label>
                  <p className="font-medium">{signupDetails.businessDescription}</p>
                </div>

                <Separator className="col-span-2 my-2" />

                {/* Bank Details */}
                <div className="col-span-2">
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">Bank Details</h4>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Sort Code</label>
                  <p className="font-medium font-mono">{signupDetails.bankSortCode}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Account Number</label>
                  <p className="font-medium font-mono">{signupDetails.bankAccountNumber}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Processing Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {deal.monthlyVolume && (
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <label className="text-sm text-gray-600">Monthly Volume</label>
                    <p className="font-medium text-lg">£{deal.monthlyVolume}</p>
                  </div>
                </div>
              )}
              {deal.currentProcessor && (
                <div>
                  <label className="text-sm text-gray-600">Current Processor</label>
                  <p className="font-medium">{deal.currentProcessor}</p>
                </div>
              )}
              {deal.currentRate && (
                <div>
                  <label className="text-sm text-gray-600">Current Rate</label>
                  <p className="font-medium">{deal.currentRate}%</p>
                </div>
              )}
              {deal.cardMachineQuantity && (
                <div>
                  <label className="text-sm text-gray-600">Card Machines Needed</label>
                  <p className="font-medium">{deal.cardMachineQuantity}</p>
                </div>
              )}
              {deal.cardMachineProvider && (
                <div>
                  <label className="text-sm text-gray-600">Current Card Machine Provider</label>
                  <p className="font-medium">{deal.cardMachineProvider}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Funding Details Card - Shows for funding deals */}
          {deal.productType === 'business_funding' && (
            <Card className="border-green-500 border-2">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Banknote className="h-5 w-5" />
                  Business Funding Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 pt-4">
                {deal.fundingAmount && (
                  <div>
                    <label className="text-sm text-gray-600">Funding Amount Requested</label>
                    <p className="font-bold text-xl text-green-600">{deal.fundingAmount}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600">Takes Card Payments</label>
                  <p className="font-medium">{deal.takesCardPayments ? 'Yes' : 'No'}</p>
                </div>
                {deal.takesCardPayments && deal.currentCardProvider && (
                  <div>
                    <label className="text-sm text-gray-600">Current Card Provider</label>
                    <Badge className={deal.currentCardProvider === 'dojo' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                      {deal.currentCardProvider === 'dojo' ? 'Dojo (Existing)' : deal.currentCardProvider.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                )}
                {deal.quoteType && (
                  <div>
                    <label className="text-sm text-gray-600">Quote Type</label>
                    <p className="font-medium capitalize">{deal.quoteType.replace(/_/g, ' ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Uploaded Documents Card */}
          {deal.billUploads && deal.billUploads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Uploaded Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deal.billUploads.map((file: any, index: number) => (
                    <div
                      key={file.id || index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{file.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {(file.fileSize / 1024).toFixed(1)} KB •
                            {file.uploadedAt && ` Uploaded ${format(new Date(file.uploadedAt), "MMM dd, yyyy")}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewFile(file.id)}
                          data-testid={`button-view-file-${index}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadFile(file.id, file.fileName)}
                          data-testid={`button-download-file-${index}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Products & Services Card */}
          {deal.selectedProducts && deal.selectedProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Requested Products & Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {deal.selectedProducts.map((product: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                      {product.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </Badge>
                  ))}
                </div>
                {deal.fundingAmount && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="text-sm text-gray-700">Business Funding Amount Requested</label>
                    <p className="font-bold text-xl text-blue-700">£{deal.fundingAmount}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Partner & Commission Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Partner & Commission Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {deal.referrer && (
                <div>
                  <label className="text-sm text-gray-600">Referring Partner</label>
                  <p className="font-medium">
                    {deal.referrer.firstName} {deal.referrer.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{deal.referrer.email}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          {deal.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Additional Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{deal.notes}</p>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Action Buttons - Different per Stage */}
          <div className="flex gap-3">
            {deal.dealStage === 'quote_request_received' && (
              <Button
                onClick={() => setShowQuoteBuilder(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-lg py-6"
                data-testid="button-open-quote-form"
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Generate Quote
              </Button>
            )}

            {deal.dealStage === 'quote_approved' && (
              <>
                <Button
                  onClick={() => setShowSignUpForm(true)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-lg py-6"
                  data-testid="button-view-signup-form"
                >
                  <ClipboardCheck className="h-5 w-5 mr-2" />
                  View Sign Up Form
                </Button>
                <Button
                  onClick={handleMoveForward}
                  disabled={isMovingForward}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-6"
                  data-testid="button-move-forward"
                >
                  <ArrowRight className="h-5 w-5 mr-2" />
                  {isMovingForward ? 'Moving...' : 'Move Forward'}
                </Button>
              </>
            )}

            {/* Live Confirm LTR Stage - Commission Creation */}
            {['live', 'live_confirm_ltr'].includes(deal.dealStage) && (
              <AdminCommissionSection deal={deal} onComplete={() => { }} />
            )}

            {/* Fallback for other stages - show basic view */}
            {deal.dealStage !== 'quote_request_received' && deal.dealStage !== 'quote_approved' && !['live', 'live_confirm_ltr'].includes(deal.dealStage) && (
              <div className="flex-1 p-4 bg-gray-50 rounded text-center text-gray-600">
                Stage: {deal.dealStage} - Actions for this stage coming soon
              </div>
            )}

            <Button
              onClick={onClose}
              variant="outline"
              className="text-lg py-6"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
