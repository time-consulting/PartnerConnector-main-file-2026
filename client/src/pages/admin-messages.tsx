import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/sidebar";
import { ArrowLeft, MessageSquare, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Fetch messages from admin endpoint
  const { data: messages = [] } = useQuery({
    queryKey: ["/api/admin/messages"],
  });

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar onExpandChange={setSidebarExpanded} />
        <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
          <div className="p-6 lg:p-8">
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
      <Sidebar onExpandChange={setSidebarExpanded} />
      <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin")}
              className="gap-2 mb-4 text-primary hover:text-primary/80 hover:bg-primary/10"
              data-testid="button-back-to-admin"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin Dashboard
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="page-title-admin-messages">
                Partner Messages & Queries
              </h1>
            </div>
            <p className="text-muted-foreground mt-1">
              View and respond to partner inquiries
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {(messages as any[]).length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-12">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No messages</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {(messages as any[]).map((message: any) => (
                  <Card key={message.id} className="bg-card border-border hover:border-primary/30 transition-all duration-200">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-foreground">
                              {message.authorName || 'Unknown User'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {message.authorType === 'partner' ? 'Partner' : 'Admin'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {new Date(message.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        {message.businessName && (
                          <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                            <p className="text-sm font-medium text-primary">
                              Deal: {message.businessName}
                            </p>
                          </div>
                        )}

                        <div className="bg-secondary/50 rounded-lg p-4 border border-border">
                          <p className="text-foreground">{message.message}</p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (message.dealId) {
                              setLocation(`/admin?deal=${message.dealId}`);
                            }
                          }}
                          className="gap-2 bg-card border-border hover:bg-secondary hover:text-foreground"
                          data-testid={`button-view-message-${message.id}`}
                        >
                          <ArrowLeft className="h-4 w-4 rotate-180" />
                          View Deal: {message.businessName || 'Unknown'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
