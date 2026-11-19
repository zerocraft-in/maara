"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

type SettingsDirtyBarProps = {
  dirty: boolean;
  saving?: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export function SettingsDirtyBar({
  dirty,
  saving = false,
  onDiscard,
  onSave,
}: SettingsDirtyBarProps) {
  const [shake, setShake] = React.useState(false);
  const guardActive = React.useRef(false);

  React.useEffect(() => {
    if (!dirty) {
      if (guardActive.current) {
        guardActive.current = false;
        window.history.back();
      }
      return;
    }

    // Add a same-page history entry while dirty. The browser Back button then
    // lands on this guard entry instead of leaving the settings page.
    window.history.pushState(
      { settingsDirtyGuard: true },
      "",
      window.location.href,
    );
    guardActive.current = true;

    const handlePopState = () => {
      setShake(true);
      window.setTimeout(() => setShake(false), 460);
      // Restore the guard entry without changing the URL or remounting the
      // form, so the user's unsaved values remain intact.
      window.history.pushState(
        { settingsDirtyGuard: true },
        "",
        window.location.href,
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dirty]);

  return (
    <div className="pointer-events-none sticky top-0 z-[1000] flex h-0 w-full justify-center px-4">
      {dirty && (
        <motion.div
          role="status"
          aria-live="polite"
          animate={shake ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
          transition={{ duration: 0.42, ease: "easeInOut" }}
          className="pointer-events-auto relative top-1 flex h-10 w-full max-w-[280px] items-center justify-between rounded-full bg-primary px-1 shadow-lg"
        >
          <span className="text-[13px] px-2 text-primary-foreground">
            Unsaved changes
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="sm"
              onClick={onDiscard}
              disabled={saving}
              className="h-8 rounded-xl bg-muted-foreground/50 px-3 text-primary-foreground hover:bg-muted-foreground/60"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onSave}
              disabled={saving}
              className="h-8 px-3 rounded-xl"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
