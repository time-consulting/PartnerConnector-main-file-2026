import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/sidebar";
import { AdminDealsPipeline } from "@/components/admin-deals-pipeline";
import {
  DollarSign,
  FileText,
  MessageSquare,
  Database,
  Shield,
} from "lucide-react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

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
                <Shield className="h-12 w-12 mx-auto mb-4 text-destructive" />
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
          {/* Header with Action Buttons */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <h1 className="text-3xl font-bold text-foreground" data-testid="page-title-admin">
                    Deal Pipeline Management
                  </h1>
                </div>
                <p className="text-muted-foreground" data-testid="text-admin-description">
                  Track and manage all deals from quote request to completion
                </p>
              </div>

              {/* Quick Access Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/payments")}
                  className="gap-2 bg-card border-border hover:bg-secondary hover:text-foreground"
                  data-testid="button-open-payments"
                >
                  <DollarSign className="h-4 w-4 text-primary" />
                  Payments
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/invoices")}
                  className="gap-2 bg-card border-border hover:bg-secondary hover:text-foreground"
                  data-testid="button-open-invoices"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  Invoices
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/messages")}
                  className="gap-2 relative bg-card border-border hover:bg-secondary hover:text-foreground"
                  data-testid="button-open-messages"
                >
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Messages
                  {(notificationCounts as any).messages > 0 && (
                    <span className="absolute -top-2.5 -right-2.5 min-w-[22px] h-[22px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 animate-pulse ring-2 ring-red-500/40 shadow-lg shadow-red-500/30">
                      {(notificationCounts as any).messages}
                    </span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin/backend")}
                  className="gap-2 bg-card border-border hover:bg-secondary hover:text-foreground"
                  data-testid="button-open-backend"
                >
                  <Database className="h-4 w-4 text-primary" />
                  Backend
                </Button>
              </div>
            </div>
          </div>

          {/* Main Pipeline Component */}
          <AdminDealsPipeline />
        </div>
      </div>
    </div>
  );
}
