import { Router, Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import ConnectionStatusNotifier from "@/components/connection-status-notifier";
import ErrorBoundary from "@/components/error-boundary";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import ImpersonationBanner from "@/components/impersonation-banner";

const SubmitDeal = lazy(() => import("@/pages/submit-deal"));
const UploadBills = lazy(() => import("@/pages/upload-bills"));
const AdminPortal = lazy(() => import("@/pages/admin"));
const AdminDiagnostics = lazy(() => import("@/pages/admin-diagnostics"));
const AdminPayments = lazy(() => import("@/pages/admin-payments"));
const AdminInvoices = lazy(() => import("@/pages/admin-invoices"));
const AdminMessages = lazy(() => import("@/pages/admin-messages"));
const AdminBackend = lazy(() => import("@/pages/admin-backend"));
const TrackDeals = lazy(() => import("@/pages/track-deals"));
const TeamManagement = lazy(() => import("@/pages/team-management"));
const Training = lazy(() => import("@/pages/training"));
const Opportunities = lazy(() => import("@/pages/opportunities"));
const Contacts = lazy(() => import("@/pages/contacts"));
const PartnerOnboarding = lazy(() => import("@/pages/partner-onboarding"));
const CommissionStructure = lazy(() => import("@/pages/commission-structure"));
const LeadTracking = lazy(() => import("@/pages/lead-tracking"));
const PartnerPortal = lazy(() => import("@/pages/partner-portal"));
const About = lazy(() => import("@/pages/about"));
const HelpCenter = lazy(() => import("@/pages/help-center"));
const PartnerRecruitment = lazy(() => import("@/pages/partner-recruitment"));
const ProfilePage = lazy(() => import("@/pages/account/profile"));
const BankingPage = lazy(() => import("@/pages/account/banking"));
const FeedbackPage = lazy(() => import("@/pages/account/feedback"));
const WaitlistPage = lazy(() => import("@/pages/waitlist"));
const SignupPage = lazy(() => import("@/pages/signup"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const QuickAddDeal = lazy(() => import("@/pages/quick-add-deal"));
const OfflinePage = lazy(() => import("@/pages/offline"));
const CommissionsPage = lazy(() => import("@/pages/commissions"));
const UserMessages = lazy(() => import("@/pages/user-messages"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const ResendVerificationPage = lazy(() => import("@/pages/resend-verification"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const BookDemo = lazy(() => import("@/pages/book-demo"));
const Integrations = lazy(() => import("@/pages/integrations"));
const NotFound = lazy(() => import("@/pages/not-found"));

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md px-6">
        <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="relative">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">PartnerConnector</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  );
}

function PrivateRoute({ children, bypassOnboarding = false }: { children: React.ReactNode; bypassOnboarding?: boolean }) {
  const { isAuthenticated, user } = useAuthContext();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (!bypassOnboarding && user && !user.hasCompletedOnboarding) {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/signup" component={SignupPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/resend-verification" component={ResendVerificationPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/onboarding" component={() => <PrivateRoute bypassOnboarding={true}><OnboardingPage /></PrivateRoute>} />
      <Route path="/waitlist" component={WaitlistPage} />
      <Route path="/offline" component={OfflinePage} />
      <Route path="/partner-onboarding" component={PartnerOnboarding} />
      <Route path="/commission-structure" component={CommissionStructure} />
      <Route path="/lead-tracking" component={LeadTracking} />
      <Route path="/partner-portal" component={PartnerPortal} />
      <Route path="/about" component={About} />
      <Route path="/help-center" component={HelpCenter} />
      <Route path="/partner-recruitment" component={PartnerRecruitment} />
      <Route path="/book-demo" component={BookDemo} />

      <Route path="/dashboard" component={() => <PrivateRoute><Dashboard /></PrivateRoute>} />

      <Route path="/opportunities" component={() => <PrivateRoute><Opportunities /></PrivateRoute>} />
      <Route path="/contacts" component={() => <PrivateRoute><Contacts /></PrivateRoute>} />
      <Route path="/submit-deal" component={() => <PrivateRoute><SubmitDeal /></PrivateRoute>} />
      <Route path="/quick-add-deal" component={() => <PrivateRoute><QuickAddDeal /></PrivateRoute>} />
      <Route path="/training" component={() => <PrivateRoute><Training /></PrivateRoute>} />
      <Route path="/upload-bills" component={() => <PrivateRoute><UploadBills /></PrivateRoute>} />
      <Route path="/track-deals" component={() => <PrivateRoute><TrackDeals /></PrivateRoute>} />
      <Route path="/commissions" component={() => <PrivateRoute><CommissionsPage /></PrivateRoute>} />
      <Route path="/team-management" component={() => <PrivateRoute><TeamManagement /></PrivateRoute>} />
      <Route path="/messages" component={() => <PrivateRoute><UserMessages /></PrivateRoute>} />
      <Route path="/account/profile" component={() => <PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="/account/banking" component={() => <PrivateRoute><BankingPage /></PrivateRoute>} />
      <Route path="/account/feedback" component={() => <PrivateRoute><FeedbackPage /></PrivateRoute>} />
      <Route path="/admin" component={() => <PrivateRoute><AdminPortal /></PrivateRoute>} />
      <Route path="/admin/diagnostics" component={() => <PrivateRoute><AdminDiagnostics /></PrivateRoute>} />
      <Route path="/admin/payments" component={() => <PrivateRoute><AdminPayments /></PrivateRoute>} />
      <Route path="/admin/invoices" component={() => <PrivateRoute><AdminInvoices /></PrivateRoute>} />
      <Route path="/admin/messages" component={() => <PrivateRoute><AdminMessages /></PrivateRoute>} />
      <Route path="/admin/backend" component={() => <PrivateRoute><AdminBackend /></PrivateRoute>} />
      <Route path="/integrations" component={() => <PrivateRoute><Integrations /></PrivateRoute>} />

      <Route path="/" component={Landing} />

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuthContext();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary fallbackMessage="The app encountered an unexpected error. Please try reloading.">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <ImpersonationBanner />
            <ConnectionStatusNotifier />
            <AuthGate>
              <Suspense fallback={<LoadingFallback />}>
                <AppRoutes />
              </Suspense>
            </AuthGate>
          </Router>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
