"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { type NavGroup, NAV_GROUPS } from "./sidebar/nav";
import { AppSidebar, type AppSidebarData } from "@/components/layout/sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GalleryVerticalEnd, Settings } from "lucide-react";
import { SettingsSidebar } from "./sidebar/settings-sidebar";
import { PageHeaderProvider } from "@/components/providers/page-header-provider";

function navGroupToNavItem(group: NavGroup): AppSidebarData["navMain"][number] {
  return {
    title: group.label,
    url: group.href,
    icon: group.icon,
    section: group.section,
    isActive: false,
    items: group.children.map((child) => ({
      title: child.label,
      url: child.href,
    })),
  };
}

export default function DashboardShell({
  children,
  user,
  memberships,
  activeOrganization,
}: {
  readonly children: React.ReactNode;
  readonly user?: { id: string; email: string | null };
  readonly memberships?: {
    organizationId: string;
    organizationName: string;
    roleKey: string;
    status: string;
  }[];
  readonly activeOrganization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}) {
  const pathname = usePathname();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Controlled sidebar open state. Shopify Admin auto-condenses the global
  // nav on Settings routes to make room for the settings secondary sidebar.
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isSettings =
    pathname === "/settings" || pathname.startsWith("/settings/");
  const effectiveSidebarOpen = sidebarOpen && !isSettings;

  React.useEffect(() => {
    if (document.cookie.split("; ").includes("sidebar_state=false")) {
      const timer = window.setTimeout(() => setSidebarOpen(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    if (!isSettings) {
      window.sessionStorage.setItem("maara-last-store-route", pathname);
    }
  }, [isSettings, pathname]);

  const sidebarData: AppSidebarData = React.useMemo(() => {
    const teams: AppSidebarData["teams"] = (memberships ?? []).map((m) => ({
      name: m.organizationName,
      logo: GalleryVerticalEnd,
      plan: m.roleKey,
    }));

    const navMain: AppSidebarData["navMain"] =
      NAV_GROUPS.map(navGroupToNavItem);

    const projects: AppSidebarData["projects"] = [];

    const navSecondary: AppSidebarData["navSecondary"] = [
      {
        title: "Settings",
        url: "/settings",
        icon: Settings ,
      },
    ];

    const userName =
      user?.email?.split("@")[0] ?? activeOrganization?.name ?? "User";

    const fallbackPlan =
      memberships?.[0]?.roleKey ?? activeOrganization?.name ?? "Member";

    return {
      user: {
        name: activeOrganization?.name ?? userName,
        email: user?.email ?? "",
        avatar: "",
      },
      teams:
        teams.length > 0
          ? teams
          : [
              {
                name: activeOrganization?.name ?? "My Org",
                logo: GalleryVerticalEnd,
                plan: fallbackPlan,
              },
            ],
      navMain,
      navSecondary,
      projects,
    };
  }, [user, memberships, activeOrganization]);

  const headerUser = user
    ? {
        name: user.email?.split("@")[0] ?? activeOrganization?.name ?? "User",
        email: user.email ?? "",
        avatar: null,
      }
    : undefined;

  return (
    <TooltipProvider>
      <SidebarProvider
        open={effectiveSidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        {/* Single persistent global sidebar — no remount flicker between routes. */}
        <AppSidebar variant="sidebar" collapsible="icon" data={sidebarData} />

        {/* Settings secondary nav — only on /settings routes. Sits between the
            condensed global nav and the content, like Shopify Admin. */}
        {isSettings && (
          <SettingsSidebar
            user={headerUser}
            organizationName={activeOrganization?.name ?? "Organization"}
            storeName={activeOrganization?.name ?? "MAARA MERCH+"}
          />
        )}

        {/* SidebarInset is the only scroll container (document never scrolls).
            The header stays fixed above the scroll area, like Shopify. */}
        <SidebarInset className="flex h-auto min-w-0 flex-col overflow-hidden bg-[var(--background)]">
         
          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            <PageHeaderProvider scrollContainerRef={scrollContainerRef}>
              {children}
            </PageHeaderProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
