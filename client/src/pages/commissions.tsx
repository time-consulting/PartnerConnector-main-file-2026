import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Clock, Download } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function CommissionsPage() {
  const { toast } = useToast();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("commissions");
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [queryDialogOpen, setQueryDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [queryNotes, setQueryNotes] = useState("");

  // Bank details state
  const [bankDetails, setBankDetails] = useState({
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: ""
  });

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"]
  });

  // Fetch commission payments
  const { data: rawPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/commission-payments"]
  });

  // Filter out 'distributed' parent payments (admin-only records)
  const payments = (rawPayments as any[]).filter((p: any) => p.paymentStatus !== 'distributed');

  // Fetch withdrawn/paid commissions
  const { data: withdrawnPayments = [], isLoading: withdrawnLoading } = useQuery({
    queryKey: ["/api/commission-payments/withdrawn"]
  });

  // Calculate totals
  const totalAvailable = payments
    .filter((p: any) => p.approvalStatus === 'approved' && p.paymentStatus === 'approved_pending')
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

  const totalPending = payments
    .filter((p: any) => p.approvalStatus === 'pending')
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

  // Bank details setup mutation
  const setupBankMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/user/bank-details", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Bank details saved successfully"
      });
      setSetupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save bank details",
        variant: "destructive"
      });
    }
  });

  // Approve payment mutation
  const approveMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return await apiRequest("PATCH", `/api/commission-payments/${paymentId}/approve`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Commission approved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-payments"] });
    }
  });

  // Query payment mutation
  const queryMutation = useMutation({
    mutationFn: async ({ paymentId, queryNotes }: any) => {
      return await apiRequest("PATCH", `/api/commission-payments/${paymentId}/query`, { queryNotes });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Query submitted successfully"
      });
      setQueryDialogOpen(false);
      setSelectedPayment(null);
      setQueryNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/commission-payments"] });
    }
  });

  const handleSetupBank = () => {
    if (!bankDetails.bankAccountName || !bankDetails.bankSortCode || !bankDetails.bankAccountNumber) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    setupBankMutation.mutate(bankDetails);
  };

  const handleApprove = (paymentId: string) => {
    approveMutation.mutate(paymentId);
  };

  const handleQuerySubmit = () => {
    if (!selectedPayment || !queryNotes) {
      toast({
        title: "Error",
        description: "Please provide query details",
        variant: "destructive"
      });
      return;
    }
    queryMutation.mutate({ paymentId: selectedPayment.id, queryNotes });
  };

  const getStatusBadge = (payment: any) => {
    if (payment.approvalStatus === 'approved') {
      return <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50">Approved</Badge>;
    }
    if (payment.approvalStatus === 'queried') {
      return <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">Queried</Badge>;
    }
    return <Badge variant="default" className="bg-blue-500/20 text-blue-400 border border-blue-500/50">Pending Approval</Badge>;
  };

  const getLevelLabel = (level: number) => {
    // Level numbering:
    // distributeCommissions: 0 = direct (60%), 1 = L1 override (20%), 2 = L2 override (10%)
    // create-commission route: 1 = direct (60%), 2 = L1 override (20%), 3 = L2 override (10%)
    if (level === 0) return "Direct Commission (60%)";
    if (level === 1) return "L1 Override (20%)";
    if (level === 2) return "L2 Override (10%)";
    if (level === 3) return "L2 Override (10%)";
    return `Level ${level}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'} p-4 md:p-6`}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Commissions & withdrawals</h1>
          </div>

          {/* Top Section - Available Funds & Setup */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Available Funds Card */}
            <Card className="border-primary/30 bg-card">
              <CardHeader>
                <CardDescription className="text-sm text-muted-foreground">Total available funds</CardDescription>
                <CardTitle className="text-3xl font-bold text-primary">£{totalAvailable.toFixed(2)} GBP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total commissions</span>
                  <span className="font-medium text-foreground">£{totalAvailable.toFixed(2)} GBP</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing fee</span>
                  <span className="font-medium text-foreground">£0.00 GBP</span>
                </div>
                <div className="pt-3 border-t border-border text-xs text-muted-foreground">
                  *Exchange rates may fluctuate at time of withdrawal
                </div>
              </CardContent>
            </Card>

            {/* Setup Withdrawals Card */}
            <Card className="border-primary/30 bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">Setup withdrawals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => setSetupDialogOpen(true)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  data-testid="button-setup-withdrawals"
                >
                  Setup withdrawals
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Select from direct deposit, PayPal or Stripe
                </p>
                {user?.bankingComplete && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Bank details configured</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Projected Earnings Card */}
            <Card className="md:col-span-2 border-primary/30 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardDescription className="text-muted-foreground">Projected earnings for this month</CardDescription>
                  <Select defaultValue="this-month">
                    <SelectTrigger className="w-[180px] border-border bg-secondary" data-testid="select-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this-month">this month</SelectItem>
                      <SelectItem value="last-month">last month</SelectItem>
                      <SelectItem value="this-year">this year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardTitle className="text-2xl font-bold text-primary">£{totalPending.toFixed(2)} GBP</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Total commissions that are <span className="font-semibold text-foreground">pending approval</span> and{" "}
                  <span className="font-semibold text-foreground">approved & pending</span> for {format(new Date(), 'MMM yyyy')}.
                </p>
              </CardHeader>
            </Card>
          </div>

          {/* Tabs Section */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <TabsList className="bg-secondary">
                <TabsTrigger value="commissions" data-testid="tab-commissions">All Commissions</TabsTrigger>
                <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">Withdrawals</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Learn about commission statuses
                </Button>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  <Download className="w-4 h-4 mr-2" />
                  Export commissions
                </Button>
              </div>
            </div>

            {/* Commissions Tab */}
            <TabsContent value="commissions" className="space-y-4">
              <Card className="border-primary/30 bg-card">
                <CardContent className="pt-6">
                  {paymentsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No commission payments yet
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-secondary/50">
                            <TableHead className="text-muted-foreground">Business Name</TableHead>
                            <TableHead className="text-muted-foreground">Type</TableHead>
                            <TableHead className="text-muted-foreground">Commission status</TableHead>
                            <TableHead className="text-muted-foreground">Payment status</TableHead>
                            <TableHead className="text-muted-foreground">Created</TableHead>
                            <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                            <TableHead className="text-muted-foreground">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment: any) => (
                            <TableRow key={payment.id} className="border-border hover:bg-secondary/30">
                              <TableCell className="font-medium text-foreground">{payment.businessName || "N/A"}</TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{getLevelLabel(payment.level)}</span>
                              </TableCell>
                              <TableCell>{getStatusBadge(payment)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-border text-foreground">{payment.paymentStatus}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.createdAt ? format(new Date(payment.createdAt), 'dd MMM yyyy') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                £{parseFloat(payment.amount).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {payment.approvalStatus === 'pending' && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                      onClick={() => handleApprove(payment.id)}
                                      disabled={approveMutation.isPending}
                                      data-testid={`button-approve-${payment.id}`}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-border hover:bg-secondary"
                                      onClick={() => {
                                        setSelectedPayment(payment);
                                        setQueryDialogOpen(true);
                                      }}
                                      data-testid={`button-query-${payment.id}`}
                                    >
                                      <AlertCircle className="w-4 h-4 mr-1" />
                                      Query
                                    </Button>
                                  </div>
                                )}
                                {payment.approvalStatus === 'queried' && (
                                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                                    Query submitted
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Withdrawals Tab */}
            <TabsContent value="withdrawals" className="space-y-4">
              <Card className="border-primary/30 bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Withdrawn Commissions</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    History of your paid commission withdrawals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {withdrawnLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : withdrawnPayments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No withdrawn payments yet</p>
                      <p className="text-sm mt-2">Approved commissions will appear here once paid</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-secondary/50">
                            <TableHead className="text-muted-foreground">Business Name</TableHead>
                            <TableHead className="text-muted-foreground">Type</TableHead>
                            <TableHead className="text-muted-foreground">Deal Stage</TableHead>
                            <TableHead className="text-muted-foreground">Payment Date</TableHead>
                            <TableHead className="text-muted-foreground">Transfer Reference</TableHead>
                            <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withdrawnPayments.map((payment: any) => (
                            <TableRow key={payment.id} className="border-border hover:bg-secondary/30">
                              <TableCell className="font-medium text-foreground">{payment.businessName || "N/A"}</TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{getLevelLabel(payment.level)}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                                  Live-Paid
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.paymentDate ? format(new Date(payment.paymentDate), 'dd MMM yyyy, HH:mm') : 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.transferReference || '-'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                £{parseFloat(payment.amount).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </div>

        {/* Bank Details Setup Dialog */}
        <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
          <DialogContent className="sm:max-w-[500px] bg-card border-primary/30" data-testid="dialog-setup-withdrawals">
            <DialogHeader>
              <DialogTitle className="text-foreground">Setup withdrawal method</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter your bank details to receive commission payments
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="accountName" className="text-foreground">Account name</Label>
                <Input
                  id="accountName"
                  placeholder="John Smith"
                  value={bankDetails.bankAccountName}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankAccountName: e.target.value })}
                  className="bg-secondary border-border"
                  data-testid="input-account-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortCode" className="text-foreground">Sort code</Label>
                <Input
                  id="sortCode"
                  placeholder="12-34-56"
                  value={bankDetails.bankSortCode}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankSortCode: e.target.value })}
                  className="bg-secondary border-border"
                  data-testid="input-sort-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber" className="text-foreground">Account number</Label>
                <Input
                  id="accountNumber"
                  placeholder="12345678"
                  value={bankDetails.bankAccountNumber}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankAccountNumber: e.target.value })}
                  className="bg-secondary border-border"
                  data-testid="input-account-number"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-border hover:bg-secondary" onClick={() => setSetupDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSetupBank} disabled={setupBankMutation.isPending} data-testid="button-save-bank">
                {setupBankMutation.isPending ? "Saving..." : "Save details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Query Payment Dialog */}
        <Dialog open={queryDialogOpen} onOpenChange={setQueryDialogOpen}>
          <DialogContent className="bg-card border-primary/30" data-testid="dialog-query-payment">
            <DialogHeader>
              <DialogTitle className="text-foreground">Query commission payment</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Please provide details about your query
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="queryNotes" className="text-foreground">Query details</Label>
                <Textarea
                  id="queryNotes"
                  placeholder="Please explain your query..."
                  value={queryNotes}
                  onChange={(e) => setQueryNotes(e.target.value)}
                  rows={4}
                  className="bg-secondary border-border"
                  data-testid="textarea-query-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-border hover:bg-secondary" onClick={() => {
                setQueryDialogOpen(false);
                setSelectedPayment(null);
                setQueryNotes("");
              }}>
                Cancel
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleQuerySubmit} disabled={queryMutation.isPending} data-testid="button-submit-query">
                {queryMutation.isPending ? "Submitting..." : "Submit query"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
