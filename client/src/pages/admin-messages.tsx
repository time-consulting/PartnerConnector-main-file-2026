import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import Sidebar from "@/components/sidebar";
import { ArrowLeft, MessageSquare, Shield, CheckCheck, Eye, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch messages from admin endpoint
  const { data: rawMessages = [] } = useQuery({
    queryKey: ["/api/admin/messages"],
  });

  const messages = rawMessages as any[];

  // Group messages by dealId for thread view
  const messagesByDeal = messages.reduce((acc: Record<string, any[]>, msg: any) => {
    const key = msg.dealId || msg.id; // fallback to id if no deal
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {} as Record<string, any[]>);

  // Get latest message per deal thread (for the summary view)
  const threads = Object.entries(messagesByDeal).map(([dealId, msgs]: [string, any[]]) => {
    const sorted = [...msgs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return {
      dealId,
      businessName: sorted[0].businessName,
      latestMessage: sorted[0],
      messages: sorted,
      unreadCount: sorted.filter((m: any) => !m.read && m.authorType !== 'admin').length,
      totalCount: sorted.length,
    };
  });

  // Sort threads by latest message date
  threads.sort((a, b) => new Date(b.latestMessage.createdAt).getTime() - new Date(a.latestMessage.createdAt).getTime());

  // Count total unread
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

  // Reply to a message (sends via deal messages API)
  const replyMutation = useMutation({
    mutationFn: async ({ dealId, message }: { dealId: string; message: string }) => {
      return await apiRequest("POST", `/api/deals/${dealId}/messages`, { message });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      setReplyText((prev) => ({ ...prev, [variables.dealId]: "" }));
      setReplyingTo(null);
      toast({
        title: "Reply sent",
        description: "Your reply has been sent to the partner.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send reply",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReply = (dealId: string) => {
    const text = replyText[dealId]?.trim();
    if (!text) return;
    replyMutation.mutate({ dealId, message: text });
  };

  const toggleThread = (dealId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
    // Mark all unread messages in this thread as read when expanding
    const thread = threads.find(t => t.dealId === dealId);
    if (thread) {
      thread.messages.forEach((msg: any) => {
        if (!msg.read && msg.authorType !== 'admin' && msg.source === 'deal') {
          markReadMutation.mutate({ messageId: msg.id, source: msg.source });
        }
      });
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar onExpandChange={setSidebarExpanded} />
        <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
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
      <div className={`transition-all duration-300 ml-0 ${sidebarExpanded ? 'md:ml-64' : 'md:ml-20'}`}>
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
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
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

          {/* Message Threads */}
          <div className="space-y-4">
            {threads.length === 0 ? (
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
                {threads.map((thread) => {
                  const isExpanded = expandedThreads.has(thread.dealId);
                  const hasUnread = thread.unreadCount > 0;

                  return (
                    <Card
                      key={thread.dealId}
                      className={`bg-card border-border transition-all duration-200 ${hasUnread
                        ? 'border-l-4 border-l-primary shadow-md shadow-primary/5'
                        : ''
                        }`}
                    >
                      <CardContent className="p-0">
                        {/* Thread Header — clickable to expand */}
                        <div
                          className="p-5 cursor-pointer hover:bg-secondary/30 transition-colors rounded-t-lg"
                          onClick={() => toggleThread(thread.dealId)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {hasUnread && (
                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse flex-shrink-0" />
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">
                                    {thread.businessName || 'Unknown Deal'}
                                  </p>
                                  {hasUnread && (
                                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                      {thread.unreadCount} NEW
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {thread.totalCount} message{thread.totalCount !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                  <span className="font-medium">{thread.latestMessage.authorName}:</span>{' '}
                                  {thread.latestMessage.message}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">
                                  {new Date(thread.latestMessage.createdAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground/70">
                                  {new Date(thread.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Thread — message history + reply box */}
                        {isExpanded && (
                          <div className="border-t border-border">
                            {/* Message history */}
                            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
                              {[...thread.messages].reverse().map((msg: any) => {
                                const isAdmin = msg.authorType === 'admin';
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                                  >
                                    <div
                                      className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isAdmin
                                        ? 'bg-primary/20 text-foreground rounded-br-sm'
                                        : 'bg-secondary text-foreground rounded-bl-sm'
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className={`text-xs font-semibold ${isAdmin ? 'text-primary' : 'text-muted-foreground'}`}>
                                          {isAdmin ? 'Admin' : msg.authorName || 'Partner'}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/60">
                                          {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                      <p className="text-sm">{msg.message}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Reply box */}
                            <div className="p-4 border-t border-border bg-secondary/20">
                              <div className="flex gap-2">
                                <Textarea
                                  placeholder="Type your reply..."
                                  value={replyText[thread.dealId] || ""}
                                  onChange={(e) => setReplyText((prev) => ({ ...prev, [thread.dealId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleReply(thread.dealId);
                                    }
                                  }}
                                  className="bg-card border-border text-foreground placeholder:text-muted-foreground resize-none min-h-[44px] max-h-[120px]"
                                  rows={1}
                                />
                                <Button
                                  onClick={() => handleReply(thread.dealId)}
                                  disabled={!replyText[thread.dealId]?.trim() || replyMutation.isPending}
                                  className="bg-primary hover:bg-primary/80 text-primary-foreground h-[44px] px-4"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                                Press Enter to send · Shift+Enter for new line
                              </p>
                            </div>
                          </div>
                        )}
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
