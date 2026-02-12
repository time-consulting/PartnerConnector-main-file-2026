import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/sidebar";
import { ArrowLeft, MessageSquare, Shield, CheckCheck, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Fetch messages from admin endpoint
  const { data: rawMessages = [] } = useQuery({
    queryKey: ["/api/admin/messages"],
  });

  const messages = rawMessages as any[];

  // Count unread partner messages
  const unreadCount = messages.filter((m: any) => !m.read && m.authorType !== 'admin').length;

  // Mark single message as read
  const markReadMutation = useMutation({
    mutationFn: async ({ messageId, source }: { messageId: string; source: string }) => {
      return await apiRequest("POST", `/api/admin/messages/${messageId}/read`, { source });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
    },
  });

  // Mark all messages as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", "/api/admin/messages/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
    },
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
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center relative">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground" data-testid="page-title-admin-messages">
                      Partner Messages & Queries
                    </h1>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1">
                  View and respond to partner inquiries
                  {unreadCount > 0 && (
                    <span className="ml-2 text-primary font-medium">
                      — {unreadCount} unread
                    </span>
                  )}
                </p>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="gap-2 bg-card border-border hover:bg-secondary hover:text-foreground"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-4">
            {messages.length === 0 ? (
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
                {messages.map((message: any) => {
                  const isUnread = !message.read && message.authorType !== 'admin';

                  return (
                    <Card
                      key={message.id}
                      className={`bg-card border-border transition-all duration-200 ${isUnread
                        ? 'border-l-4 border-l-primary shadow-md shadow-primary/5'
                        : 'hover:border-primary/30'
                        }`}
                    >
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {/* Unread dot indicator */}
                              {isUnread && (
                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse flex-shrink-0 mt-1" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`font-semibold ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                                    {message.authorName || 'Unknown User'}
                                  </p>
                                  {isUnread && (
                                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                      NEW
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {message.authorType === 'partner' ? 'Partner' : 'Admin'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-start gap-3">
                              <div>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(message.createdAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground/70">
                                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {isUnread && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markReadMutation.mutate({ messageId: message.id, source: message.source });
                                  }}
                                  disabled={markReadMutation.isPending}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  title="Mark as read"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {message.businessName && (
                            <div className={`rounded-lg px-3 py-2 ${isUnread
                              ? 'bg-primary/15 border border-primary/30'
                              : 'bg-primary/10 border border-primary/20'
                              }`}>
                              <p className="text-sm font-medium text-primary">
                                Deal: {message.businessName}
                              </p>
                            </div>
                          )}

                          <div className={`rounded-lg p-4 border ${isUnread
                            ? 'bg-secondary/70 border-border'
                            : 'bg-secondary/50 border-border'
                            }`}>
                            <p className={`${isUnread ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                              {message.message}
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Mark as read when navigating to the deal
                              if (isUnread) {
                                markReadMutation.mutate({ messageId: message.id, source: message.source });
                              }
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
