"use client"

import * as React from "react"
import {
  SquareTerminal,
  Bot,
  BookOpen,
  Settings2,
  Frame,
  PieChart,
  Map,
  GalleryVerticalEnd,
  LifeBuoy,
  Send,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { NavMain } from "./nav-main"
import { NavProjects } from "./nav-projects"
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"
import { TeamSwitcher } from "./team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

type Team = {
  name: string
  logo: LucideIcon
  plan: string
}

type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: { title: string; url: string }[]
}

type Project = {
  name: string
  url: string
  icon: LucideIcon
}

export type AppSidebarData = {
  user: {
    name: string
    email: string
    avatar: string
  }
  teams: Team[]
  navMain: NavItem[]
  navSecondary: NavItem[]
  projects: Project[]
}

const ICONS: Record<string, LucideIcon> = {
  SquareTerminal,
  Bot,
  BookOpen,
  Settings2,
  Frame,
  PieChart,
  Map,
  GalleryVerticalEnd,
  LifeBuoy,
  Send,
}

function iconFor(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined
  return (ICONS[name] ?? SquareTerminal) as LucideIcon
}

export function AppSidebar({
  data,
  ...sidebarProps
}: React.ComponentProps<typeof Sidebar> & {
  data?: AppSidebarData
}) {
  const [sidebarData, setSidebarData] = React.useState<AppSidebarData | null>(
    null
  )

  React.useEffect(() => {
    if (data) {
      setSidebarData(data)
      return
    }

    // Fall back to fetching user session client-side when no server data is
    // provided (e.g. used directly outside DashboardShell).
    ;(async () => {
      const { createBrowserSupabaseClient } = await import(
        "@/lib/supabase/client"
      )
      const supabase = createBrowserSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      if (!user) {
        return
      }
      setSidebarData({
        user: {
          name:
            user.user_metadata?.full_name ??
            user.email?.split("@")[0] ??
            "User",
          email: user.email ?? "",
          avatar:
            user.user_metadata?.avatar_url ?? "/avatars/default.jpg",
        },
        teams: [],
        navMain: [],
        navSecondary: [],
        projects: [],
      })
    })()
  }, [data])

  const sidebarDataResolved = sidebarData ?? data

  if (!sidebarDataResolved) {
    return null
  }

  return (
    <Sidebar collapsible="icon" {...sidebarProps}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarDataResolved.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarDataResolved.navMain} />
        <NavProjects projects={sidebarDataResolved.projects} />
          <NavSecondary items={sidebarDataResolved.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarDataResolved.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
