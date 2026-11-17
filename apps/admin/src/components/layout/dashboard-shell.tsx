"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { FLAT_NAV_ITEMS, isNavActive, type NavGroup } from "./sidebar/nav";
import { NAV_GROUPS } from "./sidebar/nav";
import { AppSidebar, type AppSidebarData } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/global-header/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GalleryVerticalEnd, LifeBuoy, Send, Settings } from "lucide-react";
import { SettingsSidebar } from "./sidebar/settings-sidebar";

function navGroupToNavItem(group: NavGroup): AppSidebarData["navMain"][number] {
  return {
    title: group.label,
    url: group.children[0]?.href ?? "#",
    icon: group.icon,
    isActive: false,
    items: group.children.map((child) => ({
      title: child.label,
      url: child.href,
    })),
  };
}

export default function DashboardShell({
  children,
  permissions,
  user,
  memberships,
  activeOrganization,
}: {
  readonly children: React.ReactNode;
  readonly permissions: string[];
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

  const title =
    FLAT_NAV_ITEMS.find((item) => isNavActive(pathname, item.href))?.label ||
    "Dashboard";

  // Controlled sidebar open state. Shopify Admin auto-condenses the global
  // nav on Settings routes to make room for the settings secondary sidebar.
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const isSettings =
    pathname === "/settings" || pathname.startsWith("/settings/");
  const effectiveSidebarOpen = sidebarOpen && !isSettings;

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
        name: userName,
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
        <AppSidebar variant="inset" collapsible="icon" data={sidebarData} />

        {/* Settings secondary nav — only on /settings routes. Sits between the
            condensed global nav and the content, like Shopify Admin. */}
        {isSettings && <SettingsSidebar user={headerUser} />}

        {/* SidebarInset is the only scroll container (document never scrolls).
            The header stays fixed above the scroll area, like Shopify. */}
        <SidebarInset className="flex h-auto min-w-0 flex-col overflow-hidden">
         
          <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
