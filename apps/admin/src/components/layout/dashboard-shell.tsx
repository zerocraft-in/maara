"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { FLAT_NAV_ITEMS, isNavActive, type NavGroup } from "./dashboard-nav";
import { NAV_GROUPS } from "./dashboard-nav";
import { AppSidebar, type AppSidebarData } from "@/components/layout/sidebar-07/components";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GalleryVerticalEnd } from "lucide-react";

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
  readonly activeOrganization?: { id: string; name: string; slug: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);

  const title =
    FLAT_NAV_ITEMS.find((item) => isNavActive(pathname, item.href))?.label ||
    "Dashboard";

  React.useEffect(() => {
    setLoading(false);
  }, []);

  const sidebarData: AppSidebarData = React.useMemo(() => {
    const teams: AppSidebarData["teams"] = (memberships ?? []).map((m) => ({
      name: m.organizationName,
      logo: GalleryVerticalEnd,
      plan: m.roleKey,
    }));

    const navMain: AppSidebarData["navMain"] = NAV_GROUPS.map(
      navGroupToNavItem
    );

    const projects: AppSidebarData["projects"] = [];

    const userName =
      user?.email?.split("@")[0] ??
      activeOrganization?.name ??
      "User";

    const fallbackPlan =
      memberships?.[0]?.roleKey ?? activeOrganization?.name ?? "Member";

    return {
      user: {
        name: userName,
        email: user?.email ?? "",
        avatar: `/avatars/${encodeURIComponent(user?.email ?? "default")}.jpg`,
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
      projects,
    };
  }, [user, memberships, activeOrganization]);

  if (loading) return null;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          variant="inset"
          collapsible="icon"
          data={sidebarData}
        />
        <SidebarKeyboardShortcut />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      Build Your Application
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function SidebarKeyboardShortcut() {
  const { toggleSidebar } = useSidebar();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return null;
}
