"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type Kpi = {
  label: string;
  value: string;
  note: string;
  accent: "primary" | "tag";
};

const kpis: Kpi[] = [
  {
    label: "Stock on hand",
    value: "1,248",
    note: "units across all locations",
    accent: "primary",
  },
  {
    label: "Today's sales",
    value: "₹84,320",
    note: "versus yesterday",
    accent: "primary",
  },
  {
    label: "Low stock",
    value: "12",
    note: "items need reordering",
    accent: "tag",
  },
];

type Task = {
  id: string;
  label: string;
  hint: string;
};

const tasks: Task[] = [
  {
    id: "receive",
    label: "Receive new spring stock",
    hint: "Shop — three boxes awaiting unpacking",
  },
  {
    id: "tag",
    label: "Tag summer tees S–XL",
    hint: "Size stickers on the cutting table",
  },
  {
    id: "reconcile",
    label: "Reconcile yesterday's takings",
    hint: "Shop, online, and van",
  },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const isTag = kpi.accent === "tag";
  return (
    <Card
      className="flex-1 flex flex-col border-l-4"
      style={{
        borderLeftColor: isTag ? "var(--tag)" : "var(--primary)",
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-1">
        <CardTitle
          className="text-[12px] font-medium leading-tight"
          style={{
            color: isTag ? "var(--tag)" : "var(--primary)",
          }}
        >
          {kpi.label}
        </CardTitle>
        <CardTitle className="text-[26px] font-semibold leading-tight">
          {kpi.value}
        </CardTitle>
      </CardHeader>
      <CardDescription className="mt-0.5 text-[12px]">
        {kpi.note}
      </CardDescription>
    </Card>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [done, setDone] = React.useState(false);
  return (
    <label
      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => setDone((d) => !d)}
        className="shrink-0 flex size-5 items-center justify-center rounded-sm border border-border text-sm transition-colors disabled:opacity-50"
        style={{
          borderColor: done ? "var(--primary)" : "var(--border)",
          color: done ? "var(--primary-foreground)" : "var(--muted-foreground)",
          background: done ? "var(--primary)" : "transparent",
        }}
      >
        {done && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m4.5 6 1.5 1.5L8 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[13px] font-medium leading-snug" style={{ color: "var(--foreground)" }}>
          {task.label}
        </span>
        <span className="text-[11px] leading-tight" style={{ color: "var(--muted-foreground)" }}>
          {task.hint}
        </span>
      </div>
    </label>
  );
}

export default function OverviewPage() {
  return (
    <main
      className="flex min-h-full flex-col font-manrope"
      style={{ background: "var(--background)" }}
    >
      {/* Single orchestrated motion moment: one page-load fade-in. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col px-6 py-6"
      >
        <header className="pb-6">
          <p className="text-[12px] font-medium leading-tight" style={{ color: "var(--muted-foreground)" }}>
            {greeting()}. Here is your shop floor.
          </p>
          <h1
            className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight"
            style={{ color: "var(--foreground)" }}
          >
            Here&apos;s your shop floor.
          </h1>
          <p
            className="mt-2 max-w-[64ch] text-[13px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Stock on hand, today&apos;s takings, and what needs doing before close.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </section>

        <section className="mt-8">
          <h2 className="text-[15px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
            Things to do today
          </h2>
          <ul className="mt-3 space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} />
              </li>
            ))}
          </ul>
          {tasks.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed p-6 text-center" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
                Nothing scheduled for today. You&apos;re caught up.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 flex flex-wrap gap-3">
          <Button
            onClick={() => toast.add({ title: "Sale recorded." })}
            className="bg-primary text-primary-foreground"
          >
            Record sale
          </Button>
          <Button variant="outline" onClick={() => toast.add({ title: "Stock receipt opened." })}>
            Receive stock
          </Button>
        </section>
      </motion.div>
    </main>
  );
}
