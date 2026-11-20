"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateStoreCurrency } from "./actions";

const CURRENCIES = [
  ["INR", "Indian Rupee (INR ₹)"], ["USD", "United States Dollar (USD $)"], ["GBP", "British Pound (GBP £)"], ["EUR", "Euro (EUR €)"], ["AED", "UAE Dirham (AED د.إ)"],
];

export function ChangeCurrencyDialog({ open, onOpenChange, onSaved, value = "INR" }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved?: (currency: string) => void; value?: string | null }) {
  const [currency, setCurrency] = React.useState(value || "INR");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (open) setCurrency(value || "INR"); }, [open, value]);
  async function save() { setSaving(true); const result = await updateStoreCurrency(currency); setSaving(false); if (!result.ok) { toast.error(result.error); return; } toast.success("Store currency saved"); onSaved?.(currency); onOpenChange(false); }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-[560px] gap-0 p-0"><DialogHeader className="border-b px-6 py-5 text-left"><DialogTitle>Change store currency</DialogTitle><DialogDescription className="pt-2">Store currency</DialogDescription></DialogHeader><div className="px-6 py-5"><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{CURRENCIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div><DialogFooter className="border-t bg-background px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter></DialogContent></Dialog>;
}
