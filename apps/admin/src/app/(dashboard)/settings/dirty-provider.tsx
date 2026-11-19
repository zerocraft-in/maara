"use client";

import * as React from "react";
import { SettingsDirtyBar } from "./general/settings-dirty-bar";

type DirtyForm = {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

type SettingsDirtyContextValue = {
  register: (source: string, form: DirtyForm | null) => void;
};

const SettingsDirtyContext = React.createContext<SettingsDirtyContextValue | null>(null);

export function SettingsDirtyProvider({ children }: { children: React.ReactNode }) {
  const [form, setForm] = React.useState<DirtyForm | null>(null);
  const registrations = React.useRef(new Map<string, DirtyForm>());

  const register = React.useCallback((source: string, next: DirtyForm | null) => {
    if (next) registrations.current.set(source, next);
    else registrations.current.delete(source);
    setForm(Array.from(registrations.current.values()).at(-1) ?? null);
  }, []);
  const contextValue = React.useMemo(() => ({ register }), [register]);

  return (
    <SettingsDirtyContext.Provider value={contextValue}>
      <div className="relative min-w-0">
        {form && <SettingsDirtyBar {...form} />}
        {children}
      </div>
    </SettingsDirtyContext.Provider>
  );
}

export function useSettingsDirtyForm(form: DirtyForm, enabled = true) {
  const context = React.useContext(SettingsDirtyContext);
  if (!context) throw new Error("useSettingsDirtyForm must be used inside SettingsDirtyProvider");

  const callbacks = React.useRef({ onDiscard: form.onDiscard, onSave: form.onSave });
  callbacks.current = { onDiscard: form.onDiscard, onSave: form.onSave };
  const source = React.useId();

  React.useEffect(() => {
    if (!enabled) {
      context.register(source, null);
      return;
    }
    context.register(source, {
      dirty: form.dirty,
      saving: form.saving,
      onDiscard: () => callbacks.current.onDiscard(),
      onSave: () => callbacks.current.onSave(),
    });
    return () => context.register(source, null);
  }, [context, enabled, form.dirty, form.saving, source]);
}
