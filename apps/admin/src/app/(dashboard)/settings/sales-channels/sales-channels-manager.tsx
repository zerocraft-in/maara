"use client";

import * as React from "react";
import { Search, Store, Receipt, ShoppingBag, Code2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setChannelInstallation } from "./actions";

type Channel = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  channel_type: string;
  provider: string;
  icon: string | null;
};

type Installation = {
  sales_channel_id: string;
  status: string;
  billing_status: string;
  billing_amount_minor: number;
  billing_currency: string;
  installed_at: string | null;
  connected_at: string | null;
};

const icons = { store: Store, receipt: Receipt, "shopping-bag": ShoppingBag, code: Code2, sparkles: Sparkles };

export function SalesChannelsManager({
  channels,
  installations,
  canManage,
}: {
  channels: Channel[];
  installations: Installation[];
  canManage: boolean;
}) {
  const [tab, setTab] = React.useState<"all" | "installed" | "uninstalled">("all");
  const [query, setQuery] = React.useState("");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const installationByChannel = new Map(installations.map((item) => [item.sales_channel_id, item]));

  const filtered = channels.filter((channel) => {
    const installation = installationByChannel.get(channel.id);
    const installed = installation?.status === "active" || installation?.status === "paused";
    const matchesTab = tab === "all" || (tab === "installed" ? installed : !installed);
    const matchesQuery = `${channel.name} ${channel.description ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const updateStatus = async (channel: Channel, status: "active" | "uninstalled") => {
    setBusyKey(channel.key);
    const result = await setChannelInstallation({ channelKey: channel.key, status });
    setBusyKey(null);
    if (!result.ok) {
      toast.add({ title: result.error, type: "error" });
      return;
    }
    toast.add({ title: status === "active" ? `${channel.name} enabled.` : `${channel.name} disabled.`, type: "success" });
    window.location.reload();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales channels</h1>
        <p className="mt-1 text-sm text-muted-foreground">Control where your catalogue is published and how each channel connects to Maara.</p>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Channel catalogue</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channels" className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit">
            {(["all", "installed", "uninstalled"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${tab === item ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>
                {item}
              </button>
            ))}
          </div>

          <div className="divide-y rounded-lg border">
            {filtered.map((channel) => {
              const installation = installationByChannel.get(channel.id);
              const installed = installation?.status === "active" || installation?.status === "paused";
              const Icon = icons[channel.icon as keyof typeof icons] ?? Store;
              return (
                <div key={channel.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-5" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><h3 className="font-medium">{channel.name}</h3><Badge variant={installed ? "success" : "default"}>{installed ? "Active" : "Available"}</Badge></div>
                      <p className="mt-1 text-sm text-muted-foreground">{channel.description}</p>
                    </div>
                  </div>
                  {canManage && (
                    <Button variant={installed ? "outline" : "default"} size="sm" disabled={busyKey === channel.key} onClick={() => void updateStatus(channel, installed ? "uninstalled" : "active")}>
                      {busyKey === channel.key ? "Updating…" : installed ? "Disable" : "Enable"}
                    </Button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No sales channels match this filter.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
