import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/sidebar";
import { AdminPaymentsPortal } from "@/components/admin-payments-portal";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar onExpandChange={setSidebarExpanded} />
        <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
          <div className="p-6 lg:p-8">
            <div className="rocket-card p-8 text-center">
              <p className="text-red-400">Access Denied: Admin privileges required</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
        <div className="p-6 lg:p-8">
          {/* VERIFICATION BANNER - REMOVE AFTER CONFIRMED */}
          <div className="mb-4 p-4 bg-red-600 text-white text-center text-2xl font-bold rounded-lg">
            PAYMENTS PAGE v2 – Jan 26, 2026 09:45 AM - THIS IS THE CORRECT FILE
          </div>

          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin")}
              className="gap-2 mb-4 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"
              data-testid="button-back-to-admin"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
            </Button>
            <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-2">Admin Portal</p>
            <h1 className="text-3xl font-bold text-white" data-testid="page-title-admin-payments">
              Commission Payments
            </h1>
            <p className="text-gray-500 mt-2">
              Manage and track commission payments to partners
            </p>
          </div>

          <AdminPaymentsPortal />
        </div>
      </div>
    </div>
  );
}
