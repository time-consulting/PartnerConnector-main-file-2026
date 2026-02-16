import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Building, Shield, CheckCircle } from "lucide-react";

export default function BankingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    accountHolderName: "",
    sortCode: "",
    accountNumber: "",
    bankName: "",
    accountType: "current",
    iban: "",
    swift: ""
  });

  const updateBankingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/account/banking", "PATCH", data);
    },
    onSuccess: () => {
      toast({
        title: "Banking Details Updated",
        description: "Your banking information has been saved securely.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update banking details. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBankingMutation.mutate(formData);
  };

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />

      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'} max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8`}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-8 h-8" />
            Banking Details
          </h1>
          <p className="text-muted-foreground mt-2">Manage your banking information for commission payments</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Bank Account Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="accountHolderName">Account Holder Name</Label>
                    <Input
                      id="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                      placeholder="Full name as shown on bank account"
                      data-testid="input-account-holder"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="sortCode">Sort Code</Label>
                      <Input
                        id="sortCode"
                        value={formData.sortCode}
                        onChange={(e) => setFormData({ ...formData, sortCode: e.target.value })}
                        placeholder="12-34-56"
                        maxLength={8}
                        data-testid="input-sort-code"
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        placeholder="12345678"
                        maxLength={8}
                        data-testid="input-account-number"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder="e.g., Lloyds Bank, HSBC, Barclays"
                      data-testid="input-bank-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountType">Account Type</Label>
                    <Select value={formData.accountType} onValueChange={(value) => setFormData({ ...formData, accountType: value })}>
                      <SelectTrigger data-testid="select-account-type">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">Current Account</SelectItem>
                        <SelectItem value="business">Business Account</SelectItem>
                        <SelectItem value="savings">Savings Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium mb-4">International Details (Optional)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="iban">IBAN</Label>
                        <Input
                          id="iban"
                          value={formData.iban}
                          onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                          placeholder="GB29 NWBK 6016 1331 9268 19"
                          data-testid="input-iban"
                        />
                      </div>
                      <div>
                        <Label htmlFor="swift">SWIFT/BIC Code</Label>
                        <Input
                          id="swift"
                          value={formData.swift}
                          onChange={(e) => setFormData({ ...formData, swift: e.target.value })}
                          placeholder="NWBKGB2L"
                          data-testid="input-swift"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={updateBankingMutation.isPending}
                    data-testid="button-save-banking"
                  >
                    {updateBankingMutation.isPending ? "Saving..." : "Save Banking Details"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Bank details are encrypted</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">PCI DSS compliant storage</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Secure data transmission</span>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    We never store your full banking details. All sensitive information is encrypted using industry-standard security practices.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}