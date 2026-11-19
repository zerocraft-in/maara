"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, ShoppingBag } from "lucide-react";

import { NavMain } from "./nav-main";
import { NavProjects } from "./nav-projects";
import { NavSecondary } from "./nav-secondary";
import { SearchForm } from "./search-form";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type Team = {
  name: string;
  logo: LucideIcon;
  plan: string;
};

type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  section?: string;
  items?: { title: string; url: string }[];
};

type Project = {
  name: string;
  url: string;
  icon: LucideIcon;
};

export type AppSidebarData = {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  teams: Team[];
  navMain: NavItem[];
  navSecondary: NavItem[];
  projects: Project[];
};

export function AppSidebar({
  data,
  ...sidebarProps
}: React.ComponentProps<typeof Sidebar> & {
  data?: AppSidebarData;
}) {
  const { state, toggleSidebar } = useSidebar();
  const [fallbackData, setFallbackData] =
    React.useState<AppSidebarData | null>(null);

  React.useEffect(() => {
    if (data) {
      return;
    }

    let cancelled = false;

    // Fall back to fetching user session client-side when no server data is
    // provided (e.g. used directly outside DashboardShell).
    (async () => {
      const { createBrowserSupabaseClient } =
        await import("@/lib/supabase/client");
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user || cancelled) {
        return;
      }

      setFallbackData({
        user: {
          name:
            user.user_metadata?.full_name ??
            user.email?.split("@")[0] ??
            "User",
          email: user.email ?? "",
          avatar: user.user_metadata?.avatar_url ?? "/avatars/default.jpg",
        },
        teams: [],
        navMain: [],
        navSecondary: [],
        projects: [],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  const sidebarData = data ?? fallbackData;

  if (!sidebarData) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" {...sidebarProps}>
      <SidebarHeader className="px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => state === "collapsed" && toggleSidebar()}
            aria-label={state === "collapsed" ? "Expand sidebar" : "Shopify admin"}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#95bf47] transition-colors hover:bg-sidebar-accent"
          >
            <span className="relative flex size-7 items-center justify-center">
              <ShoppingBag className="size-7 fill-[#95bf47] stroke-[#95bf47]" />
              <span className="absolute inset-0 flex items-center justify-center pt-1 text-[12px] font-black text-white">S</span>
            </span>
          </button>
          <SidebarTrigger
            aria-label="Collapse sidebar"
            className="size-8 text-white/70 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden"
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="pt-2">
        <SearchForm />
        <NavMain items={sidebarData.navMain} />
        {sidebarData.projects.length > 0 && <NavProjects projects={sidebarData.projects} />}

        <NavSecondary
          items={sidebarData.navSecondary}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <div className="relative">
          <NavUser user={sidebarData.user} />
          <Bell className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-white/60 group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarFooter>
      {/* not set a sidebar rail */}
      {/* <SidebarRail /> */}
    </Sidebar>
  );
}
