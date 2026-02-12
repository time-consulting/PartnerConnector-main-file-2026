import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Users,
  DollarSign,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Zap,
  Target,
  MessageSquare,
  Contact,
  Lightbulb,
  Briefcase,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
}

interface MenuGroup {
  icon: any;
  label: string;
  items: MenuItem[];
}

type MenuEntry = MenuItem | MenuGroup;

function isMenuGroup(entry: MenuEntry): entry is MenuGroup {
  return 'items' in entry;
}

export default function Sidebar({ onExpandChange }: SidebarProps = {}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [location, setLocation] = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ["/api/user/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  const unreadCount = (unreadData as any)?.unreadCount || 0;

  const handleMouseEnter = () => {
    setIsExpanded(true);
    onExpandChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    onExpandChange?.(false);
    setOpenDropdowns([]);
  };

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {});
      toast({
        title: "Logged out successfully",
        description: "See you soon!",
      });
      setLocation('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const toggleDropdown = (label: string) => {
    setOpenDropdowns(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const menuEntries: MenuEntry[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    {
      icon: Briefcase,
      label: "Deals",
      items: [
        { icon: FileText, label: "Submit Deal", path: "/submit-deal" },
        { icon: Target, label: "Track Deals", path: "/track-deals" },
      ]
    },
    { icon: MessageSquare, label: "Messages", path: "/messages" },
    {
      icon: TrendingUp,
      label: "Pipeline",
      items: [
        { icon: Contact, label: "Contacts", path: "/contacts" },
        { icon: Lightbulb, label: "Opportunities", path: "/opportunities" },
      ]
    },
    {
      icon: DollarSign,
      label: "Earnings",
      items: [
        { icon: DollarSign, label: "Commissions", path: "/commissions" },
        { icon: Users, label: "Team", path: "/team-management" },
      ]
    },
    { icon: Settings, label: "Settings", path: "/account/profile" },
  ];

  const isActive = (path: string) => location === path;

  const isGroupActive = (group: MenuGroup) => {
    return group.items.some(item => location === item.path);
  };

  const renderMenuItem = (item: MenuItem) => {
    const isMessages = item.label === "Messages";
    return (
      <Link key={item.path} href={item.path}>
        <button
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive(item.path)
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="relative">
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {isMessages && unreadCount > 0 && !isExpanded && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          {isExpanded && (
            <span className="text-sm font-medium whitespace-nowrap flex-1">
              {item.label}
            </span>
          )}
          {isExpanded && isMessages && unreadCount > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse ring-2 ring-red-500/30">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {isExpanded && !isMessages && isActive(item.path) && (
            <ChevronRight className="w-4 h-4 ml-auto" />
          )}
        </button>
      </Link>
    );
  };

  const renderMenuGroup = (group: MenuGroup) => {
    const isOpen = openDropdowns.includes(group.label);
    const groupActive = isGroupActive(group);

    return (
      <div key={group.label} className="space-y-1">
        <button
          onClick={() => isExpanded && toggleDropdown(group.label)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${groupActive
              ? "bg-primary/20 text-primary border border-primary/30"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          data-testid={`nav-${group.label.toLowerCase()}`}
        >
          <group.icon className="w-5 h-5 flex-shrink-0" />
          {isExpanded && (
            <>
              <span className="text-sm font-medium whitespace-nowrap">
                {group.label}
              </span>
              <ChevronDown
                className={`w-4 h-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </>
          )}
        </button>

        {isExpanded && isOpen && (
          <div className="ml-4 pl-4 border-l border-sidebar-border space-y-1">
            {group.items.map(item => (
              <Link key={item.path} href={item.path}>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${isActive(item.path)
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                  {isActive(item.path) && (
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  )}
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed left-0 top-0 h-screen transition-all duration-300 z-40 bg-sidebar border-r border-sidebar-border ${isExpanded ? "w-64" : "w-20"
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary shadow-lg shadow-primary/30">
              <Zap className="w-5 h-5 text-primary-foreground" fill="currentColor" />
            </div>
            {isExpanded && (
              <span className="text-lg font-bold text-white whitespace-nowrap">
                PartnerConnector
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuEntries.map((entry) =>
            isMenuGroup(entry)
              ? renderMenuGroup(entry)
              : renderMenuItem(entry)
          )}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full flex items-center gap-3 px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isExpanded && (
              <span className="text-sm font-medium whitespace-nowrap">
                Logout
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
