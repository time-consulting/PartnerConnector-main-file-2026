import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import Sidebar from "@/components/sidebar";
import {
    MessageSquare, Send, ChevronDown, ChevronUp, ArrowLeft,
    Building, Bot, User, Inbox, CheckCheck, Filter
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FilterTab = "all" | "unread" | "read";

export default function UserMessagesPage() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const { toast } = useToast();

    // Fetch all messages across all user's deals
    const { data: rawMessages = [], isLoading } = useQuery({
        queryKey: ["/api/user/messages"],
    });

    const messages = rawMessages as any[];

    // Mark all messages as read when page loads and messages are fetched
    useEffect(() => {
        if (!isLoading && messages.length > 0) {
            apiRequest("PATCH", "/api/user/messages/mark-all-read")
                .then(() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/user/messages"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/user/unread-count"] });
                })
                .catch((err) => console.error("Failed to mark all as read:", err));
        }
    }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    // Group messages by dealId for thread view
    const messagesByDeal = messages.reduce((acc: Record<string, any[]>, msg: any) => {
        const key = msg.dealId || msg.id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(msg);
        return acc;
    }, {} as Record<string, any[]>);

    // Build thread summaries
    const allThreads = Object.entries(messagesByDeal).map(([dealId, msgs]: [string, any[]]) => {
        const sorted = [...msgs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const unreadCount = sorted.filter((m: any) => m.isAdmin && !m.read).length;
        return {
            dealId,
            businessName: sorted[0].businessName || 'Unknown Deal',
            latestMessage: sorted[0],
            messages: sorted,
            unreadCount,
            hasUnread: unreadCount > 0,
            totalCount: sorted.length,
        };
    });

    // Sort threads: unread first, then by latest message
    allThreads.sort((a, b) => {
        if (a.hasUnread && !b.hasUnread) return -1;
        if (!a.hasUnread && b.hasUnread) return 1;
        return new Date(b.latestMessage.createdAt).getTime() - new Date(a.latestMessage.createdAt).getTime();
    });

    // Apply tab filter
    const filteredThreads = allThreads.filter(thread => {
        if (activeTab === "unread") return thread.hasUnread;
        if (activeTab === "read") return !thread.hasUnread;
        return true; // "all"
    });

    const totalUnread = allThreads.reduce((sum, t) => sum + t.unreadCount, 0);
    const totalThreads = allThreads.length;
    const readThreads = allThreads.filter(t => !t.hasUnread).length;

    // Reply mutation
    const replyMutation = useMutation({
        mutationFn: async ({ dealId, message }: { dealId: string; message: string }) => {
            return await apiRequest("POST", `/api/deals/${dealId}/messages`, { message });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/messages"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user/unread-count"] });
            queryClient.invalidateQueries({ queryKey: [`/api/deals/${variables.dealId}/messages`] });
            setReplyText((prev) => ({ ...prev, [variables.dealId]: "" }));
            toast({
                title: "Message sent",
                description: "Your message has been sent to Support.",
            });
        },
        onError: () => {
            toast({
                title: "Failed to send",
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
        const isCurrentlyExpanded = expandedThreads.has(dealId);

        setExpandedThreads(prev => {
            const next = new Set(prev);
            if (next.has(dealId)) {
                next.delete(dealId);
            } else {
                next.add(dealId);
            }
            return next;
        });

        // Mark messages as read when EXPANDING the thread
        if (!isCurrentlyExpanded) {
            apiRequest("PATCH", `/api/user/messages/${dealId}/read`)
                .then(() => {
                    // Refresh messages and unread count after marking as read
                    queryClient.invalidateQueries({ queryKey: ["/api/user/messages"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/user/unread-count"] });
                })
                .catch((err) => console.error("Failed to mark messages as read:", err));
        }
    };

    const tabItems: { key: FilterTab; label: string; count: number; icon: any }[] = [
        { key: "all", label: "All", count: totalThreads, icon: Inbox },
        { key: "unread", label: "Unread", count: totalUnread, icon: MessageSquare },
        { key: "read", label: "Read", count: readThreads, icon: CheckCheck },
    ];

    return (
        <div className="min-h-screen bg-background">
            <Sidebar onExpandChange={setSidebarExpanded} />
            <div className={sidebarExpanded ? 'ml-64' : 'ml-20'}>
                <div className="p-6 lg:p-8">
                    {/* Header */}
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            onClick={() => setLocation("/dashboard")}
                            className="gap-2 mb-4 text-primary hover:text-primary/80 hover:bg-primary/10"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Button>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center relative">
                                <MessageSquare className="h-6 w-6 text-primary" />
                                {totalUnread > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center animate-pulse ring-2 ring-red-500/30">
                                        {totalUnread}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">Messages</h1>
                                <p className="text-muted-foreground">
                                    All conversations with the Support team across your deals
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 mb-6">
                        {tabItems.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                    : "bg-card text-muted-foreground border border-border hover:bg-secondary hover:text-foreground"
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key
                                        ? "bg-primary-foreground/20 text-primary-foreground"
                                        : tab.key === "unread" && tab.count > 0
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-muted text-muted-foreground"
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Loading state */}
                    {isLoading ? (
                        <Card className="bg-card border-border">
                            <CardContent className="p-12">
                                <div className="text-center text-muted-foreground">
                                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                                    <p>Loading messages...</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : filteredThreads.length === 0 ? (
                        <Card className="bg-card border-border">
                            <CardContent className="p-12">
                                <div className="text-center text-muted-foreground">
                                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium mb-1">
                                        {activeTab === "unread" ? "No unread messages" :
                                            activeTab === "read" ? "No read messages" :
                                                "No messages yet"}
                                    </p>
                                    <p className="text-sm">
                                        {activeTab === "unread"
                                            ? "You're all caught up! Check the 'All' tab to see all conversations."
                                            : activeTab === "read"
                                                ? "No conversations have been read yet."
                                                : "When Support responds to one of your deals, the conversation will appear here."}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {filteredThreads.map((thread) => {
                                const isExpanded = expandedThreads.has(thread.dealId);

                                return (
                                    <Card
                                        key={thread.dealId}
                                        className={`bg-card border-border transition-all duration-200 ${thread.hasUnread
                                            ? 'border-l-4 border-l-primary shadow-lg shadow-primary/5'
                                            : ''
                                            }`}
                                    >
                                        <CardContent className="p-0">
                                            {/* Thread Header — clickable */}
                                            <div
                                                className="p-5 cursor-pointer hover:bg-secondary/30 transition-colors rounded-t-lg"
                                                onClick={() => toggleThread(thread.dealId)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${thread.hasUnread ? 'bg-primary/20' : 'bg-secondary'
                                                            }`}>
                                                            <Building className={`h-5 w-5 ${thread.hasUnread ? 'text-primary' : 'text-muted-foreground'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {thread.hasUnread && (
                                                                    <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse flex-shrink-0" />
                                                                )}
                                                                <p className="font-semibold text-foreground">
                                                                    {thread.businessName}
                                                                </p>
                                                                {thread.hasUnread && (
                                                                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                                                        {thread.unreadCount} NEW
                                                                    </Badge>
                                                                )}
                                                                <span className="text-xs text-muted-foreground">
                                                                    {thread.totalCount} message{thread.totalCount !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                                                                <span className="font-medium">
                                                                    {thread.latestMessage.isAdmin ? 'Support' : 'You'}:
                                                                </span>{' '}
                                                                {thread.latestMessage.message}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 ml-3">
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

                                            {/* Expanded Thread — chat bubbles + reply */}
                                            {isExpanded && (
                                                <div className="border-t border-border">
                                                    {/* Chat history */}
                                                    <div className="p-5 space-y-3 max-h-[500px] overflow-y-auto">
                                                        {[...thread.messages].reverse().map((msg: any) => {
                                                            const isAdminMsg = msg.isAdmin;
                                                            return (
                                                                <div
                                                                    key={msg.id}
                                                                    className={`flex gap-2 ${isAdminMsg ? 'justify-start' : 'justify-end'}`}
                                                                >
                                                                    {isAdminMsg && (
                                                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                                            <Bot className="w-4 h-4 text-primary" />
                                                                        </div>
                                                                    )}
                                                                    <div
                                                                        className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isAdminMsg
                                                                            ? 'bg-secondary text-foreground rounded-bl-sm'
                                                                            : 'bg-primary/20 text-foreground rounded-br-sm'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <p className={`text-xs font-semibold ${isAdminMsg ? 'text-primary' : 'text-muted-foreground'}`}>
                                                                                {isAdminMsg ? 'Support' : 'You'}
                                                                            </p>
                                                                            <p className="text-[10px] text-muted-foreground/60">
                                                                                {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </p>
                                                                            {!msg.read && isAdminMsg && (
                                                                                <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                                                                    NEW
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm">{msg.message}</p>
                                                                    </div>
                                                                    {!isAdminMsg && (
                                                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                                            <User className="w-4 h-4 text-primary" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Reply box */}
                                                    <div className="p-4 border-t border-border bg-secondary/20">
                                                        <div className="flex gap-2">
                                                            <Textarea
                                                                placeholder="Type your message..."
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
    );
}
