"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* Every toolbar control prevents mousedown default so the editor keeps its selection. */
const keepSelection = (e: React.MouseEvent) => e.preventDefault();

type ToolbarButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  label: string;
  active?: boolean;
};

export const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton({ label, active, className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        onMouseDown={keepSelection}
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-md px-1.5 text-foreground/80 transition-colors",
          "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-40",
          active && "bg-accent text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export function ToolbarSeparator() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

interface ToolbarMenuProps {
  label: string;
  trigger: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  children: (close: () => void) => React.ReactNode;
}

/** Small self-contained dropdown (no Radix / shadcn dropdown needed). */
export function ToolbarMenu({
  label,
  trigger,
  disabled,
  active,
  triggerClassName,
  contentClassName,
  children,
}: ToolbarMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={ref} className="relative">
      <ToolbarButton
        label={label}
        active={open || active}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </ToolbarButton>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute left-0 top-full z-50 mt-1 min-w-[11rem] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
            contentClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
  onSelect: () => void;
  children: React.ReactNode;
}

export function MenuItem({ icon, active, disabled, danger, className, onSelect, children }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
        "disabled:pointer-events-none disabled:opacity-40",
        danger && "text-destructive hover:text-destructive",
        className,
      )}
    >
      {icon && <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="flex-1">{children}</span>
      {active && <Check className="size-4 shrink-0" />}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-border" />;
}

export { keepSelection };
