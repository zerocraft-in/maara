"use client";

import * as React from "react";
import {
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Globe,
  Layers,
  Scale,
  Clock,
  Hash,
  Barcode,
  Folder,
  Sparkles,
  BookOpen,
  Headphones,
  Code,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type IconName =
  | "Mail"
  | "Phone"
  | "MapPin"
  | "DollarSign"
  | "Globe"
  | "Layers"
  | "Scale"
  | "Clock"
  | "Hash"
  | "Barcode"
  | "Folder"
  | "Sparkles"
  | "BookOpen"
  | "Headphones"
  | "Code"
  | "Activity";

const ICONS: Record<IconName, React.ElementType> = {
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Globe,
  Layers,
  Scale,
  Clock,
  Hash,
  Barcode,
  Folder,
  Sparkles,
  BookOpen,
  Headphones,
  Code,
  Activity,
};

type SettingsRowProps = {
  icon: IconName;
  label: string;
  description?: string | null;
  href?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
};

export function SettingsRow({
  icon,
  label,
  description,
  href,
  onClick,
  badge,
}: SettingsRowProps) {
  const Icon = ICONS[icon];
  const handleClick = (e: React.MouseEvent) => {
    if (href && e.currentTarget === e.target) return;
    onClick?.();
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 text-sm transition-colors rounded-lg cursor-pointer",
        href || onClick ? undefined : "cursor-default",
      )}
      onClick={href || onClick ? handleClick : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center justify-center size-5 rounded-sm bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex flex-col leading-none">
          <span className="font-medium text-foreground">{label}</span>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      </div>
      {badge && <span className="text-xs">{badge}</span>}
      {(href || onClick) && <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
    </div>
  );
}
