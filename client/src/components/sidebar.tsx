import { useState, useEffect } from "react";
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
  TrendingUp,
  Rocket,
  Menu,
  X
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ["/api/user/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  const unreadCount = (unreadData as any)?.unreadCount || 0;

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

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
    { icon: Rocket, label: "Grow Your Business", path: "/grow-your-business" },
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

  const renderMenuItem = (item: MenuItem, isMobile = false) => {
    const isMessages = item.label === "Messages";
    const showLabel = isMobile || isExpanded;
    return (
      <Link key={item.path} href={item.path}>
        <button
          className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg transition-all text-left ${isActive(item.path)
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="relative flex-shrink-0">
            <item.icon className="w-5 h-5" />
            {isMessages && unreadCount > 0 && !showLabel && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          {showLabel && (
            <span className="text-sm font-medium whitespace-nowrap flex-1">
              {item.label}
            </span>
          )}
          {showLabel && isMessages && unreadCount > 0 && (
            <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse ring-2 ring-red-500/30">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {showLabel && !isMessages && isActive(item.path) && (
            <ChevronRight className="w-4 h-4 ml-auto" />
          )}
        </button>
      </Link>
    );
  };

  const renderMenuGroup = (group: MenuGroup, isMobile = false) => {
    const isOpen = openDropdowns.includes(group.label);
    const groupActive = isGroupActive(group);
    const showLabel = isMobile || isExpanded;

    return (
      <div key={group.label} className="space-y-1">
        <button
          onClick={() => (isMobile || isExpanded) && toggleDropdown(group.label)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${groupActive
            ? "bg-primary/20 text-primary border border-primary/30"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          data-testid={`nav-${group.label.toLowerCase()}`}
        >
          <group.icon className="w-5 h-5 flex-shrink-0" />
          {showLabel && (
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

        {showLabel && isOpen && (
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
    <>
      {/* Mobile hamburger button — fixed top-left, visible only on mobile */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 bg-sidebar border border-sidebar-border rounded-lg flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        data-testid="mobile-menu-toggle"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`fixed left-0 top-0 h-screen w-72 bg-sidebar border-r border-sidebar-border z-50 md:hidden transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile header with close button */}
          <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary shadow-lg shadow-primary/30">
                <Zap className="w-5 h-5 text-primary-foreground" fill="currentColor" />
              </div>
              <span className="text-lg font-bold text-white whitespace-nowrap">
                PartnerConnector
              </span>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuEntries.map((entry) =>
              isMenuGroup(entry)
                ? renderMenuGroup(entry, true)
                : renderMenuItem(entry, true)
            )}
          </nav>

          {/* Mobile logout */}
          <div className="p-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full flex items-center gap-3 px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
              data-testid="button-logout-mobile"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">
                Logout
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar — hidden on mobile, visible on md+ */}
      <div
        className={`fixed left-0 top-0 h-screen transition-all duration-300 z-40 bg-sidebar border-r border-sidebar-border hidden md:block ${isExpanded ? "w-64" : "w-20"
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
    </>
  );
}
