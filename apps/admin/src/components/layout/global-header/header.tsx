"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type HeaderProps = {
  readonly title: string;
  readonly user?: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string | null;
  } | null;
};

export function Header({ title, user }: HeaderProps) {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = React.useState(false);

  const displayName = user?.name?.trim() || "User";
  const displayEmail = user?.email?.trim() || "";
  const avatarUrl = user?.avatar?.trim() || null;
  const initial = displayName.charAt(0).toUpperCase() || "U";

  const handleLogout = async () => {
    if (logoutLoading) {
      return;
    }

    setLogoutLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast.error("Unable to sign out. Please try again.");
        return;
      }

      router.replace("/login");
    } catch {
      toast.error("Unable to sign out. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 px-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open user menu"
            className="inline-flex items-center justify-center gap-2 rounded-md px-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <User className="size-4" />
            <span className="hidden sm:block">{displayName}</span>
            <Avatar className="h-7 w-7 rounded-full">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback className="rounded-full">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={displayName} />
                    ) : null}
                    <AvatarFallback className="rounded-lg">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>
                    <span className="truncate text-xs">{displayEmail}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={logoutLoading}
              aria-busy={logoutLoading}
            >
              <LogOut className="mr-2 size-4" />
              {logoutLoading ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
