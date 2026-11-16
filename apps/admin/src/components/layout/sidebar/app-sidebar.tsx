"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { NavMain } from "./nav-main";
import { NavProjects } from "./nav-projects";
import { NavSecondary } from "./nav-secondary";
import { SearchForm } from "./search-form";
import { NavUser } from "./nav-user";
import { TeamSwitcher } from "./team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
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
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />
      </SidebarHeader>
      <SidebarContent className="pt-2">
        <SearchForm />
        <NavMain items={sidebarData.navMain} />
        <NavProjects projects={sidebarData.projects} />

        <NavSecondary
          items={sidebarData.navSecondary}
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      {/* not set a sidebar rail */}
      {/* <SidebarRail /> */}
    </Sidebar>
  );
}
