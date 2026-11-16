"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavUserProps {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  onUpgrade?: () => void;
  onAccount?: () => void;
  onBilling?: () => void;
  onNotifications?: () => void;
  onLogout?: () => void;
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "U";
}

export function NavUser({
  user,
  onUpgrade,
  onAccount,
  onBilling,
  onNotifications,
  onLogout,
}: NavUserProps) {
  const { isMobile } = useSidebar();
  const displayName = user.name?.trim() || "User";
  const displayEmail = user.email?.trim() || "";
  const initials = getInitials(displayName);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="
                  data-[popup-open]:bg-sidebar-accent
                  data-[popup-open]:text-sidebar-accent-foreground
                "
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {displayName}
                  </span>

                  <span className="truncate text-xs text-muted-foreground">
                    {displayEmail}
                  </span>
                </div>

                <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
              </SidebarMenuButton>
            }
          />

          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.avatar ? (
                      <AvatarImage src={user.avatar} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>

                    <span className="truncate text-xs text-muted-foreground">
                      {displayEmail}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onUpgrade?.()}>
                <Sparkles className="mr-2 size-4" />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onAccount?.()}>
                <BadgeCheck className="mr-2 size-4" />
                Account
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => onBilling?.()}>
                <CreditCard className="mr-2 size-4" />
                Billing
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => onNotifications?.()}>
                <Bell className="mr-2 size-4" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onClick={() => onLogout?.()}
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
