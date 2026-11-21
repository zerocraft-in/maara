"use client";

import * as React from "react";
import { DirtyBar } from "./dirty-bar";

export type DirtyForm = {
  dirty: boolean;
  saving: boolean;
  label?: string;
  onDiscard: () => void;
  onSave: () => void;
};

type DirtyContextValue = {
  register: (source: string, form: DirtyForm | null) => void;
};

const DirtyContext = React.createContext<DirtyContextValue | null>(null);

export function DirtyProvider({ children }: { children: React.ReactNode }) {
  const [form, setForm] = React.useState<DirtyForm | null>(null);
  const registrations = React.useRef(new Map<string, DirtyForm>());

  const register = React.useCallback((source: string, next: DirtyForm | null) => {
    if (next) registrations.current.set(source, next);
    else registrations.current.delete(source);
    setForm(Array.from(registrations.current.values()).at(-1) ?? null);
  }, []);

  const contextValue = React.useMemo(() => ({ register }), [register]);

  return (
    <DirtyContext.Provider value={contextValue}>
      <div className="relative min-w-0">
        {form && <DirtyBar {...form} />}
        {children}
      </div>
    </DirtyContext.Provider>
  );
}

export function useDirtyForm(form: DirtyForm, enabled = true) {
  const context = React.useContext(DirtyContext);
  if (!context) throw new Error("useDirtyForm must be used inside DirtyProvider");

  const source = React.useId();

  React.useEffect(() => {
    if (!enabled) {
      context.register(source, null);
      return;
    }

    context.register(source, {
      dirty: form.dirty,
      saving: form.saving,
      label: form.label,
      onDiscard: form.onDiscard,
      onSave: form.onSave,
    });
    return () => context.register(source, null);
  }, [context, enabled, form.dirty, form.label, form.onDiscard, form.onSave, form.saving, source]);
}

// Backwards-compatible name for existing settings forms.
export const useSettingsDirtyForm = useDirtyForm;
