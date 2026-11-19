"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSettingsDirtyForm } from "../dirty-provider";
import { Label } from "@/components/ui/label";
import {
  Palette,
  Sun,
  Moon,
  Layers,
  LayoutGrid,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ThemeMode = "light" | "dark" | "system";
type AccentColor =
  | "brand"
  | "blue"
  | "emerald"
  | "rose"
  | "amber"
  | "violet"
  | "cyan"
  | "indigo";
type BorderRadius = "none" | "sm" | "md" | "lg" | "xl" | "full";
type FontSizeScale = "sm" | "base" | "md" | "lg" | "xl";
type Density = "compact" | "comfortable" | "spacious";

const THEME_MODES: { value: ThemeMode; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Layers },
];

const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: "brand", label: "Brand", color: "#0f6b5f" },
  { value: "blue", label: "Blue", color: "#2563eb" },
  { value: "emerald", label: "Emerald", color: "#10b981" },
  { value: "rose", label: "Rose", color: "#f43f5e" },
  { value: "amber", label: "Amber", color: "#f59e0b" },
  { value: "violet", label: "Violet", color: "#8b5cf6" },
  { value: "cyan", label: "Cyan", color: "#06b6d4" },
  { value: "indigo", label: "Indigo", color: "#6366f1" },
];

const BORDER_RADIUS_OPTIONS: { value: BorderRadius; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
  { value: "full", label: "Pill" },
];

const FONT_SIZE_OPTIONS: { value: FontSizeScale; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "base", label: "Base" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
];

const DENSITY_OPTIONS: { value: Density; label: string; description: string }[] = [
  { value: "compact", label: "Compact", description: "Tight spacing" },
  { value: "comfortable", label: "Comfortable", description: "Balanced spacing" },
  { value: "spacious", label: "Spacious", description: "Generous whitespace" },
];

export default function AppearancePage() {
  const defaults = React.useMemo(() => ({ themeMode: "system" as ThemeMode, accentColor: "brand" as AccentColor, borderRadius: "md" as BorderRadius, fontSize: "base" as FontSizeScale, density: "comfortable" as Density, animationsEnabled: true, highContrast: false, reduceMotion: false, compactSidebar: false }), []);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(defaults.themeMode);
  const [accentColor, setAccentColor] = React.useState<AccentColor>(defaults.accentColor);
  const [borderRadius, setBorderRadius] = React.useState<BorderRadius>(defaults.borderRadius);
  const [fontSize, setFontSize] = React.useState<FontSizeScale>(defaults.fontSize);
  const [density, setDensity] = React.useState<Density>(defaults.density);
  const [animationsEnabled, setAnimationsEnabled] = React.useState(defaults.animationsEnabled);
  const [highContrast, setHighContrast] = React.useState(defaults.highContrast);
  const [reduceMotion, setReduceMotion] = React.useState(defaults.reduceMotion);
  const [compactSidebar, setCompactSidebar] = React.useState(defaults.compactSidebar);
  const [saved, setSaved] = React.useState(defaults);
  const [saving, setSaving] = React.useState(false);
  const current = { themeMode, accentColor, borderRadius, fontSize, density, animationsEnabled, highContrast, reduceMotion, compactSidebar };
  const dirty = Object.keys(defaults).some((key) => current[key as keyof typeof current] !== saved[key as keyof typeof saved]);

  function discardChanges() {
    setThemeMode(saved.themeMode); setAccentColor(saved.accentColor); setBorderRadius(saved.borderRadius); setFontSize(saved.fontSize); setDensity(saved.density);
    setAnimationsEnabled(saved.animationsEnabled); setHighContrast(saved.highContrast); setReduceMotion(saved.reduceMotion); setCompactSidebar(saved.compactSidebar);
  }

  // Apply theme mode to document root immediately
  React.useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("light", "dark");
    if (themeMode === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      html.classList.add(prefersDark ? "dark" : "light");
    } else {
      html.classList.add(themeMode);
    }
  }, [themeMode]);

  // Apply accent color as CSS variable
  React.useEffect(() => {
    const active = ACCENT_COLORS.find((c) => c.value === accentColor);
    if (active) {
      document.documentElement.style.setProperty("--accent-color", active.color);
    }
  }, [accentColor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const settings = {
        theme_mode: themeMode,
        accent_color: accentColor,
        border_radius: borderRadius,
        font_size: fontSize,
        density: density,
        animations_enabled: animationsEnabled,
        high_contrast: highContrast,
        reduce_motion: reduceMotion,
        compact_sidebar: compactSidebar,
      };
      await supabase
        .from("user_settings")
        .upsert({ settings }, { onConflict: "user_id" });
    } catch {
      // settings table may not exist yet; save locally
      localStorage.setItem("maara:appearance", JSON.stringify({
        themeMode, accentColor, borderRadius, fontSize, density,
        animationsEnabled, highContrast, reduceMotion, compactSidebar,
      }));
    } finally {
      setSaving(false);
      setSaved({ ...current });
    }
  };

  useSettingsDirtyForm({ dirty, saving, onDiscard: discardChanges, onSave: () => void handleSave() });

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      <Separator className="mt-4 mb-8" />

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose how the interface adapts to light and dark environments.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-3 gap-3">
            {THEME_MODES.map((item) => {
              const isActive = themeMode === item.value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => setThemeMode(item.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                    isActive
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Checkbox
              checked={themeMode === "system"}
              onCheckedChange={(v) => setThemeMode(v ? "system" : themeMode)}
              disabled={themeMode === "system"}
              className="h-4 w-4 shrink-0"
            />
            <Label className="text-sm text-muted-foreground">
              Follow system theme preference
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Separator className="my-8" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Palette className="size-4" /> Colors
          </CardTitle>
          <CardDescription>
            Primary accent color used for buttons, links, active states, and highlights.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => {
              const isActive = accentColor === color.value;
              return (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition-colors w-20",
                    isActive
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full border border-border shadow-sm flex items-center justify-center mb-1",
                      isActive ? "ring-2 ring-primary ring-offset-1" : "",
                    )}
                    style={{ backgroundColor: color.color }}
                  />
                  <span>{color.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Border Radius */}
      <Separator className="my-8" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Border Radius
          </CardTitle>
          <CardDescription>
            Control corner roundness across cards, buttons, inputs, and other elements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <select value={borderRadius} onChange={(event) => setBorderRadius(event.target.value as BorderRadius)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            {BORDER_RADIUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </CardContent>
      </Card>

      {/* Layout */}
      <Separator className="my-8" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <LayoutGrid className="size-4 mr-2" /> Layout
          </CardTitle>
          <CardDescription>
            Adjust font size, content density, and sidebar width.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <select value={fontSize} onChange={(event) => setFontSize(event.target.value as FontSizeScale)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {FONT_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={density} onChange={(event) => setDensity(event.target.value as Density)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {DENSITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Checkbox
              checked={compactSidebar}
              onCheckedChange={(v) => setCompactSidebar(!!v)}
              className="h-4 w-4 shrink-0"
            />
            <Label className="text-sm text-muted-foreground">
              Compact sidebar
            </Label>
            <span className="text-xs text-muted-foreground ml-auto">
              Narrower sidebar to maximize content area
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Performance */}
      <Separator className="my-8" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Rocket className="size-4 mr-2" /> Performance
          </CardTitle>
          <CardDescription>
            Control animations and motion preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <SettingToggle
            label="Enable animations"
            description="Smooth transitions for modals, dropdowns, and navigation."
            checked={animationsEnabled}
            onChange={setAnimationsEnabled}
          />
          <SettingToggle
            label="Reduce motion"
            description="Disable animated transitions for accessibility and performance."
            checked={reduceMotion}
            onChange={setReduceMotion}
          />
          <SettingToggle
            label="High contrast"
            description="Increase contrast between elements for improved readability."
            checked={highContrast}
            onChange={setHighContrast}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="h-4 w-4 shrink-0"
      />
    </div>
  );
}
