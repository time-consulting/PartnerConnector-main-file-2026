import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Building,
  User,
  Mail,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  Calculator,
  Users,
  Archive
} from "lucide-react";

export function AdminPaymentsPortal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [calculatedBreakdown, setCalculatedBreakdown] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<{ [key: number]: string }>({});
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [transferReference, setTransferReference] = useState("");

  // Fetch payments needing approval (from new commission workflow)
  const { data: needsApprovalPayments = [], isLoading: needsApprovalLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/payments/needs-approval'],
  });

  // Fetch live accounts
  const { data: liveAccounts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/payments/live-accounts'],
  });

  // Fetch approved commissions ready for withdrawal
  const { data: approvedPayments = [], isLoading: approvedLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/commission-payments/approved'],
  });

  // Approve payment mutation (for needs_approval payments)
  // Uses the simpler /approve endpoint that takes paymentId directly
  const approveMutation = useMutation({
    mutationFn: async (payment: any) => {
      console.log('[APPROVE-V3] Payment ID:', payment.id);
      console.log('[APPROVE-V3] Business Name:', payment.businessName);
      console.log('[APPROVE-V3] Total Commission:', payment.totalCommission || payment.grossAmount);

      if (!payment.id) {
        const errorMsg = `Payment ID is missing! Keys: ${Object.keys(payment).join(', ')}`;
        alert(`DEBUG ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Use the simple /approve endpoint — takes paymentId directly, no deal lookup needed
      const url = `/api/admin/payments/${payment.id}/approve`;
      console.log('[APPROVE-V3] Calling:', url);

      const response = await apiRequest('POST', url);
      const result = await response.json();
      console.log('[APPROVE-V3] Response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('[APPROVE-V3] SUCCESS:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/needs-approval'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-payments/approved'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/live-accounts'] });
      toast({
        title: "Payment Approved",
        description: data?.message || "Commission payment has been approved and distributed.",
      });
    },
    onError: (error: any) => {
      console.error('[APPROVE-V3] FAILED:', error);
      alert(`APPROVE FAILED: ${error.message}`);
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve payment",
        variant: "destructive",
      });
    },
  });

  // Mark as Paid mutation (for approved payments)
  const markPaidMutation = useMutation({
    mutationFn: async ({ paymentId, transferReference }: { paymentId: string; transferReference?: string }) => {
      const response = await apiRequest('POST', `/api/admin/payments/${paymentId}/mark-paid`, {
        transferReference
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/needs-approval'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-payments/approved'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/live-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals/with-quotes'] });
      setWithdrawDialogOpen(false);
      setSelectedPayment(null);
      setTransferReference("");
      toast({
        title: "Payment Marked as Paid",
        description: "Commission payment has been marked as paid and deal is now complete.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Mark Paid Failed",
        description: error.message || "Failed to mark payment as paid",
        variant: "destructive",
      });
    },
  });

  // Withdrawal mutation
  const withdrawMutation = useMutation({
    mutationFn: async ({ paymentId, transferReference }: { paymentId: string; transferReference?: string }) => {
      const response = await apiRequest('PATCH', `/api/admin/commission-payments/${paymentId}/withdraw`, {
        transferReference
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-payments/approved'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/live-accounts'] });
      setWithdrawDialogOpen(false);
      setSelectedPayment(null);
      setTransferReference("");
      toast({
        title: "Payment Withdrawn",
        description: "Commission payment has been marked as paid and withdrawn successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  // Calculate breakdown mutation
  const calculateMutation = useMutation({
    mutationFn: async ({ quoteId, totalAmount }: { quoteId: string; totalAmount: string }) => {
      const response = await apiRequest('POST', '/api/admin/payments/calculate', {
        quoteId,
        totalAmount
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setCalculatedBreakdown(data);
      setManualOverrides({}); // Reset overrides on new calculation
      toast({
        title: "Calculation Complete",
        description: "Commission breakdown has been calculated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Calculation Failed",
        description: error.message || "Failed to calculate commission breakdown",
        variant: "destructive",
      });
    },
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await apiRequest('POST', '/api/admin/payments/process', paymentData);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/live-accounts'] });
      setSelectedQuote(null);
      setPaymentAmount("");
      setCalculatedBreakdown(null);
      setShowConfirmation(false);
      setManualOverrides({});

      toast({
        title: data.success ? "Payments Processed" : "Partial Success",
        description: data.message,
        variant: data.totalFailed > 0 ? "destructive" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Processing Failed",
        description: error.message || "Failed to process payments",
        variant: "destructive",
      });
    },
  });

  // Archive payment mutation
  const archiveMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest('DELETE', `/api/admin/payments/${paymentId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/needs-approval'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/commission-payments/approved'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/live-accounts'] });
      toast({
        title: "Payment Archived",
        description: "Payment has been archived and removed from the portal.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Archive Failed",
        description: error.message || "Failed to archive payment",
        variant: "destructive",
      });
    },
  });

  const handleCalculate = () => {
    if (!selectedQuote || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    calculateMutation.mutate({
      quoteId: selectedQuote.id,
      totalAmount: paymentAmount
    });
  };

  const handleProcessPayment = () => {
    if (!calculatedBreakdown) {
      toast({
        title: "No Calculation",
        description: "Please calculate the breakdown first",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmation(true);
  };

  const confirmPayment = () => {
    // Apply manual overrides to breakdown
    const finalBreakdown = calculatedBreakdown.breakdown.map((item: any, index: number) => {
      if (manualOverrides[index]) {
        return {
          ...item,
          amount: parseFloat(manualOverrides[index]).toFixed(2),
          manualOverride: true
        };
      }
      return item;
    });

    processPaymentMutation.mutate({
      quoteId: selectedQuote.id,
      totalAmount: paymentAmount,
      paymentReference: `PAY-${selectedQuote.quoteId || selectedQuote.id}`,
      breakdown: finalBreakdown
    });
  };

  const handleOverrideChange = (index: number, value: string) => {
    setManualOverrides(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const getDisplayAmount = (item: any, index: number) => {
    return manualOverrides[index] || item.amount;
  };

  const getTotalDistributed = () => {
    if (!calculatedBreakdown) return "0.00";

    let total = 0;
    calculatedBreakdown.breakdown.forEach((item: any, index: number) => {
      const amount = manualOverrides[index] ? parseFloat(manualOverrides[index]) : parseFloat(item.amount);
      total += amount;
    });
    return total.toFixed(2);
  };

  // Dark theme colors matching dashboard
  const darkBg = "hsl(200, 20%, 6%)";
  const cardBg = "hsl(200, 18%, 10%)";
  const cardBorder = "hsl(174, 40%, 18%)";
  const cyanAccent = "#22d3ee";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: cyanAccent }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Version Banner - update timestamp to verify deployment */}
      <div className="px-4 py-2 rounded-lg text-xs font-mono" style={{ background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)', color: '#22d3ee' }}>
        🚀 Payment Portal v3.0 — Last deploy: 11 Feb 2026 20:50 UTC — REWIRED: Approve uses paymentId directly
      </div>
      {/* Header */}
      <div
        className="p-6 rounded-xl"
        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(34, 211, 238, 0.15)', color: cyanAccent }}
              >
                <DollarSign className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Payment Portal</h2>
            </div>
            <p style={{ color: '#6b7280' }}>
              Process commission payments for completed live accounts
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: cyanAccent }}>
              {liveAccounts.length}
            </div>
            <div className="text-sm" style={{ color: '#6b7280' }}>Pending Payments</div>
          </div>
        </div>
      </div>

      {/* Needs Approval Queue - Commission Payments from LIVE deals */}
      {!needsApprovalLoading && needsApprovalPayments.length > 0 && (
        <div
          className="p-6 rounded-xl"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: '4px solid #f59e0b' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5" style={{ color: '#fbbf24' }} />
            <h3 className="text-xl font-bold" style={{ color: '#ffffff' }}>Pending Approval ({needsApprovalPayments.length})</h3>
          </div>
          <p className="mb-4" style={{ color: '#6b7280' }}>
            Review and approve commission payments from LIVE deals before processing
          </p>
          <div className="space-y-4">
            {needsApprovalPayments.map((payment: any) => (
              <div
                key={payment.id}
                className="p-4 rounded-lg"
                style={{ background: darkBg, border: `1px solid ${cardBorder}` }}
                data-testid={`payment-needs-approval-${payment.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-lg" style={{ color: '#ffffff' }}>
                      {payment.businessName || payment.deal?.businessName || "N/A"}
                    </div>
                    <div className="text-sm mt-1" style={{ color: '#6b7280' }}>
                      Referrer: {payment.recipientName || "Unknown"}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs" style={{ borderColor: cardBorder, color: '#9ca3af' }}>
                        {payment.deal?.productType || "card_payments"}
                      </Badge>
                      <Badge className="text-xs" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.5)' }}>
                        Needs Approval
                      </Badge>
                    </div>

                    {/* Evidence Link */}
                    {payment.evidenceUrl && (
                      <div className="mt-2">
                        <a
                          href={payment.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                          style={{ color: cyanAccent }}
                        >
                          View Evidence
                        </a>
                      </div>
                    )}

                    {/* Commission Splits Preview */}
                    {payment.splits && payment.splits.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                        <div className="text-xs mb-2" style={{ color: '#6b7280' }}>Commission Splits:</div>
                        <div className="space-y-1">
                          {payment.splits.map((split: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span style={{ color: '#6b7280' }}>
                                L{split.level}: {split.beneficiaryName} ({split.percentage}%)
                              </span>
                              <span className="font-medium" style={{ color: '#ffffff' }}>
                                {payment.currency || 'GBP'} {parseFloat(split.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audit Info */}
                    <div className="mt-2 text-xs" style={{ color: '#4b5563' }}>
                      Created by: {payment.createdByName || "System"} on {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "N/A"}
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold" style={{ color: '#fbbf24' }}>
                      {payment.currency || 'GBP'} {parseFloat(payment.grossAmount || payment.totalCommission || payment.amount).toFixed(2)}
                    </div>
                    <div className="text-xs mb-3" style={{ color: '#6b7280' }}>Gross Commission</div>

                    <Button
                      onClick={() => approveMutation.mutate(payment)}
                      disabled={approveMutation.isPending}
                      style={{ background: '#0891b2', color: '#ffffff' }}
                      className="hover:opacity-90"
                      size="sm"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={() => {
                        if (confirm("Are you sure you want to archive this payment?")) {
                          archiveMutation.mutate(payment.id);
                        }
                      }}
                      disabled={archiveMutation.isPending}
                      variant="outline"
                      style={{ borderColor: cardBorder, color: '#ef4444' }}
                      className="hover:bg-red-500/10"
                      size="sm"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Payments Ready for Withdrawal */}
      {!approvedLoading && approvedPayments.length > 0 && (
        <div
          className="p-6 rounded-xl"
          style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: `4px solid ${cyanAccent}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5" style={{ color: cyanAccent }} />
            <h3 className="text-xl font-bold" style={{ color: '#ffffff' }}>Approved Commissions Ready for Withdrawal</h3>
          </div>
          <p className="mb-4" style={{ color: '#6b7280' }}>
            Process bank transfers for these approved commission payments
          </p>
          <div className="space-y-3">
            {approvedPayments.map((payment: any) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ background: darkBg, border: `1px solid ${cardBorder}` }}
                data-testid={`payment-approved-${payment.id}`}
              >
                <div className="flex-1">
                  <div className="font-medium" style={{ color: '#ffffff' }}>
                    {payment.businessName || "N/A"}
                  </div>
                  <div className="text-sm mt-1" style={{ color: '#6b7280' }}>
                    {payment.recipientName} • {payment.recipientEmail}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs" style={{ borderColor: cardBorder, color: '#9ca3af' }}>
                      Level {payment.level} - {payment.percentage}%
                    </Badge>
                    <Badge className="text-xs" style={{ background: 'rgba(34, 211, 238, 0.2)', color: cyanAccent, border: `1px solid ${cyanAccent}50` }}>
                      Approved
                    </Badge>
                  </div>
                </div>
                <div className="text-right mr-4">
                  <div className="text-2xl font-bold" style={{ color: cyanAccent }}>
                    £{parseFloat(payment.amount).toFixed(2)}
                  </div>
                  <div className="text-xs" style={{ color: '#6b7280' }}>
                    {payment.bankAccountNumber ? `****${payment.bankAccountNumber.slice(-4)}` : "No bank details"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelectedPayment(payment);
                      setWithdrawDialogOpen(true);
                    }}
                    style={{ background: '#0891b2', color: '#ffffff' }}
                    className="hover:opacity-90"
                    data-testid={`button-withdraw-${payment.id}`}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm("Are you sure you want to archive this payment?")) {
                        archiveMutation.mutate(payment.id);
                      }
                    }}
                    disabled={archiveMutation.isPending}
                    variant="outline"
                    style={{ borderColor: cardBorder, color: '#ef4444' }}
                    className="hover:bg-red-500/10"
                    size="icon"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Accounts Grid */}
      {liveAccounts.length === 0 ? (
        <div
          className="p-12 text-center rounded-xl"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{ color: cyanAccent }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: '#ffffff' }}>All Caught Up!</h3>
          <p style={{ color: '#6b7280' }}>No pending commission payments at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {liveAccounts.map((account: any) => (
            <div
              key={account.id}
              className="overflow-hidden rounded-xl"
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderLeft: `4px solid ${cyanAccent}` }}
              data-testid={`card-payment-${account.id}`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-lg font-bold" style={{ color: '#ffffff' }}>
                      <Building className="h-5 w-5" style={{ color: cyanAccent }} />
                      {account.deal?.businessName || "Unknown Business"}
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                        <Mail className="h-4 w-4" />
                        {account.deal?.businessEmail || "No email"}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: cardBorder, color: '#9ca3af' }}>
                          {account.quoteId || account.id}
                        </Badge>
                        <Badge className="text-xs" style={{ background: 'rgba(34, 211, 238, 0.2)', color: cyanAccent, border: `1px solid ${cyanAccent}50` }}>
                          LIVE ACCOUNT
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm" style={{ color: '#6b7280' }}>Est. Commission</div>
                    <div className="text-2xl font-bold" style={{ color: cyanAccent }}>
                      £{parseFloat(account.estimatedCommission || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Upline Structure */}
                <div
                  className="mb-4 p-3 rounded-lg"
                  style={{ background: darkBg, border: `1px solid ${cardBorder}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4" style={{ color: '#6b7280' }} />
                    <h4 className="text-sm font-semibold" style={{ color: '#9ca3af' }}>MLM Structure</h4>
                  </div>
                  <div className="space-y-2">
                    {/* Level 1 - Direct */}
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="text-xs" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)' }}>L1 - 60%</Badge>
                      <User className="h-3 w-3" style={{ color: '#6b7280' }} />
                      <span className="font-medium" style={{ color: '#ffffff' }}>
                        {account.user ? `${account.user.firstName} ${account.user.lastName}` : "No user"}
                      </span>
                      <span style={{ color: '#4b5563' }}>({account.user?.email})</span>
                    </div>

                    {/* Level 2 - Parent */}
                    {account.uplineUsers && account.uplineUsers.length > 0 && (
                      <div className="flex items-center gap-2 text-xs pl-4">
                        <ArrowRight className="h-3 w-3" style={{ color: '#374151' }} />
                        <Badge className="text-xs" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.5)' }}>L2 - 20%</Badge>
                        <User className="h-3 w-3" style={{ color: '#6b7280' }} />
                        <span className="font-medium" style={{ color: '#ffffff' }}>
                          {account.uplineUsers[0].firstName} {account.uplineUsers[0].lastName}
                        </span>
                        <span style={{ color: '#4b5563' }}>({account.uplineUsers[0].email})</span>
                      </div>
                    )}

                    {/* Level 3 - Grandparent */}
                    {account.uplineUsers && account.uplineUsers.length > 1 && (
                      <div className="flex items-center gap-2 text-xs pl-8">
                        <ArrowRight className="h-3 w-3" style={{ color: '#374151' }} />
                        <Badge className="text-xs" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.5)' }}>L3 - 10%</Badge>
                        <User className="h-3 w-3" style={{ color: '#6b7280' }} />
                        <span className="font-medium" style={{ color: '#ffffff' }}>
                          {account.uplineUsers[1].firstName} {account.uplineUsers[1].lastName}
                        </span>
                        <span style={{ color: '#4b5563' }}>({account.uplineUsers[1].email})</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setSelectedQuote(account);
                      setPaymentAmount(account.estimatedCommission || "");
                      setCalculatedBreakdown(null);
                    }}
                    style={{ background: '#0891b2', color: '#ffffff' }}
                    className="w-full hover:opacity-90"
                    data-testid={`button-process-payment-${account.id}`}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Process Payment
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm("Are you sure you want to archive this deal?")) {
                        archiveMutation.mutate(account.id);
                      }
                    }}
                    disabled={archiveMutation.isPending}
                    variant="outline"
                    style={{ borderColor: cardBorder, color: '#ef4444' }}
                    className="hover:bg-red-500/10"
                    size="sm"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Processing Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={(open) => {
        if (!open) {
          setSelectedQuote(null);
          setPaymentAmount("");
          setCalculatedBreakdown(null);
        }
      }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
              <DollarSign className="h-5 w-5" style={{ color: cyanAccent }} />
              Process Commission Payment
            </DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              {selectedQuote?.deal?.businessName} - {selectedQuote?.quoteId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Amount Input */}
            <div>
              <Label htmlFor="payment-amount" style={{ color: '#9ca3af' }}>Total Payment Amount (LTR)</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }}>£</span>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-7"
                    style={{ background: darkBg, border: `1px solid ${cardBorder}`, color: '#ffffff' }}
                    placeholder="0.00"
                    data-testid="input-payment-amount"
                  />
                </div>
                <Button
                  onClick={handleCalculate}
                  disabled={calculateMutation.isPending}
                  style={{ background: '#0891b2', color: '#ffffff' }}
                  className="hover:opacity-90"
                  data-testid="button-calculate-breakdown"
                >
                  {calculateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Calculator className="h-4 w-4 mr-2" />
                      Calculate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Commission Breakdown */}
            {calculatedBreakdown && (
              <div
                className="space-y-3 p-4 rounded-xl"
                style={{ background: darkBg, border: `1px solid ${cardBorder}` }}
              >
                <h4 className="font-semibold" style={{ color: '#ffffff' }}>Commission Breakdown</h4>

                {calculatedBreakdown.breakdown.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg"
                    style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            className="text-xs"
                            style={
                              item.level === 1 ? { background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)' } :
                                item.level === 2 ? { background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.5)' } :
                                  { background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.5)' }
                            }
                          >
                            Level {item.level}
                          </Badge>
                          <div>
                            <div className="font-medium text-sm" style={{ color: '#ffffff' }}>{item.userName}</div>
                            <div className="text-xs" style={{ color: '#4b5563' }}>{item.userEmail}</div>
                            <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{item.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm mb-1" style={{ color: '#6b7280' }}>
                            Auto: £{parseFloat(item.amount).toFixed(2)} ({item.percentage}%)
                          </div>
                        </div>
                      </div>

                      {/* Manual Override Input */}
                      <div>
                        <Label htmlFor={`override-${index}`} className="text-xs" style={{ color: '#6b7280' }}>
                          Manual Override / Bonus
                        </Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6b7280' }}>£</span>
                          <Input
                            id={`override-${index}`}
                            type="number"
                            step="0.01"
                            value={getDisplayAmount(item, index)}
                            onChange={(e) => handleOverrideChange(index, e.target.value)}
                            className="pl-7"
                            style={{ background: darkBg, border: `1px solid ${cardBorder}`, color: '#ffffff' }}
                            placeholder={parseFloat(item.amount).toFixed(2)}
                            data-testid={`input-override-${index}`}
                          />
                        </div>
                        {manualOverrides[index] && (
                          <div className="text-xs mt-1 flex items-center gap-1" style={{ color: '#fbbf24' }}>
                            <AlertCircle className="h-3 w-3" />
                            Manual override applied
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                  <div className="flex items-center justify-between font-bold" style={{ color: '#ffffff' }}>
                    <span>Total Distribution:</span>
                    <span style={{ color: cyanAccent }}>
                      £{getTotalDistributed()}
                    </span>
                  </div>
                  {Object.keys(manualOverrides).length > 0 && (
                    <div className="text-xs mt-1 flex items-center gap-1" style={{ color: '#fbbf24' }}>
                      <AlertCircle className="h-3 w-3" />
                      Manual overrides applied
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedQuote(null);
                setPaymentAmount("");
                setCalculatedBreakdown(null);
                setManualOverrides({});
              }}
              style={{ borderColor: cardBorder, color: '#9ca3af' }}
              className="hover:opacity-80"
              data-testid="button-cancel-payment"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessPayment}
              disabled={!calculatedBreakdown || processPaymentMutation.isPending}
              style={{ background: '#0891b2', color: '#ffffff' }}
              className="hover:opacity-90"
              data-testid="button-confirm-payment"
            >
              {processPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Process Payment via Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
              <AlertCircle className="h-5 w-5" style={{ color: '#fbbf24' }} />
              Confirm Payment
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#6b7280' }}>
              You are about to process <strong style={{ color: '#ffffff' }}>£{getTotalDistributed()}</strong> in commission payments
              to <strong style={{ color: '#ffffff' }}>{calculatedBreakdown?.breakdown.length}</strong> recipients.
              {Object.keys(manualOverrides).length > 0 && (
                <>
                  <br /><br />
                  <span className="font-semibold" style={{ color: '#fbbf24' }}>
                    Manual overrides have been applied to {Object.keys(manualOverrides).length} payment(s)
                  </span>
                </>
              )}
              <br /><br />
              This action cannot be undone. The payments will be recorded and ready for bank transfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderColor: cardBorder, color: '#9ca3af' }} className="hover:opacity-80" data-testid="button-cancel-confirmation">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPayment}
              style={{ background: '#0891b2', color: '#ffffff' }}
              className="hover:opacity-90"
              data-testid="button-confirm-stripe-payment"
            >
              Confirm & Send Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdrawal Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent
          className="sm:max-w-[500px]"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#ffffff' }}>
              <Send className="h-5 w-5" style={{ color: cyanAccent }} />
              Confirm Commission Withdrawal
            </DialogTitle>
            <DialogDescription style={{ color: '#6b7280' }}>
              Mark this commission payment as paid and provide optional transfer reference
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-4">
              <div
                className="p-4 space-y-2 rounded-xl"
                style={{ background: darkBg, border: `1px solid ${cardBorder}` }}
              >
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: '#6b7280' }}>Business:</span>
                  <span className="font-medium" style={{ color: '#ffffff' }}>{selectedPayment.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: '#6b7280' }}>Recipient:</span>
                  <span className="font-medium" style={{ color: '#ffffff' }}>{selectedPayment.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: '#6b7280' }}>Amount:</span>
                  <span className="font-bold" style={{ color: cyanAccent }}>£{parseFloat(selectedPayment.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: '#6b7280' }}>Bank Account:</span>
                  <span className="font-medium" style={{ color: '#ffffff' }}>
                    {selectedPayment.bankAccountNumber ? `****${selectedPayment.bankAccountNumber.slice(-4)}` : "N/A"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferReference" style={{ color: '#9ca3af' }}>Transfer Reference (Optional)</Label>
                <Input
                  id="transferReference"
                  placeholder="e.g. TXN123456789"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  style={{ background: darkBg, border: `1px solid ${cardBorder}`, color: '#ffffff' }}
                  data-testid="input-transfer-reference"
                />
                <p className="text-xs" style={{ color: '#4b5563' }}>
                  Enter the bank transfer reference number for tracking purposes
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawDialogOpen(false);
                setSelectedPayment(null);
                setTransferReference("");
              }}
              style={{ borderColor: cardBorder, color: '#9ca3af' }}
              className="hover:opacity-80"
              data-testid="button-cancel-withdraw"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedPayment) {
                  markPaidMutation.mutate({
                    paymentId: selectedPayment.id,
                    transferReference: transferReference || undefined
                  });
                }
              }}
              disabled={markPaidMutation.isPending}
              style={{ background: '#0891b2', color: '#ffffff' }}
              className="hover:opacity-90"
              data-testid="button-confirm-withdraw"
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Payment Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
