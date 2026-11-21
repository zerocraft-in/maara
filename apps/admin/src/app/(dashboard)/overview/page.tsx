"use client";

import Link from "next/link";
import * as React from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  Globe2,
  Mic,
  Paperclip,
  Palette,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type FeedCard = {
  id: string;
  title: string;
  description: string;
  action: string;
  href?: string;
  icon: React.ElementType;
  tint: string;
  bullets?: string[];
};
const metrics = [
  { label: "Sessions", value: "1", note: "vs. previous period" },
  { label: "Total sales", value: "₹0", note: "vs. previous period" },
  { label: "Orders", value: "0", note: "vs. previous period" },
  { label: "Conversion rate", value: "0%", note: "vs. previous period" },
];
const initialFeed: FeedCard[] = [
  {
    id: "dropshipping",
    title: "Learn the dropshipping basics",
    description:
      "See how to find products, build your store, and start selling.",
    action: "Watch now",
    icon: ShoppingBag,
    tint: "oklch(0.94 0.02 265)",
  },
  {
    id: "launch",
    title: "Launch your online store",
    description:
      "Ready to open for business? Take your store public and start welcoming customers.",
    action: "Launch store",
    href: "/settings",
    icon: Store,
    tint: "oklch(0.96 0.025 90)",
  },
  {
    id: "payments",
    title: "Set up payments",
    description:
      "Choose a payment provider to let customers pay by card or digital wallet.",
    action: "Activate payments",
    href: "/settings/payments",
    icon: CreditCard,
    tint: "oklch(0.94 0.015 240)",
  },
  {
    id: "domain",
    title: "Get maraapparels a matching domain",
    description:
      "We found domain names that match your store. Choose your favorite and make it yours.",
    action: "Choose a domain",
    href: "/settings/domains",
    icon: Globe2,
    tint: "oklch(0.96 0.025 90)",
    bullets: ["maraapparels.com", "maraapparels.in", "maraapparels.net"],
  },
  {
    id: "shipping",
    title: "Review shipping rates",
    description:
      "Look over the shipping defaults based on your store location.",
    action: "Review rates",
    href: "/settings/shipping",
    icon: Truck,
    tint: "oklch(0.95 0.015 350)",
  },
  {
    id: "homepage",
    title: "Boost conversion with a customized homepage",
    description:
      "Use your theme and apps to tailor the homepage for your customers.",
    action: "View guide",
    href: "/online-store",
    icon: Palette,
    tint: "oklch(0.94 0.018 300)",
  },
];

function StatsBar() {
  return (
    <div
      className="shrink-0"
      style={{
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-end gap-2 px-6 pt-3">
        {[
          { label: "Last 30 days", icon: CalendarDays },
          { label: "All channels", icon: Globe2 },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium hover:bg-[var(--muted)]"
            style={{
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
            }}
          >
            <Icon
              className="size-3.5"
              style={{ color: "var(--muted-foreground)" }}
            />
            {label}
            <ChevronDown
              className="size-3"
              style={{ color: "var(--muted-foreground)" }}
            />
          </button>
        ))}
      </div>
      <div className="flex items-stretch">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className="flex flex-1 flex-col px-5 py-3"
            style={{
              borderRight:
                i < metrics.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span
              className="text-[12px]"
              style={{ color: "var(--foreground)" }}
            >
              {m.label}
            </span>
            <span
              className="mt-0.5 text-[22px] font-semibold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {m.value}
            </span>
            <span
              className="mt-0.5 text-[11px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              {m.note}
            </span>
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2 px-5 py-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: "oklch(0.6 0.17 145)" }}
        />
        <span className="text-[12px]" style={{ color: "var(--foreground)" }}>
          Live visitors
        </span>
        <span
          className="text-[12px] font-medium"
          style={{ color: "var(--foreground)" }}
        >
          0
        </span>
        <Link
          href="/analytics"
          className="ml-0.5"
          style={{ color: "var(--primary)" }}
        >
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function FeedArticle({
  card,
  onDismiss,
}: {
  card: FeedCard;
  onDismiss: (id: string) => void;
}) {
  const Icon = card.icon;
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-xl"
      style={{ border: "1px solid var(--border)", background: "var(--card)" }}
    >
      <button
        type="button"
        aria-label={`Dismiss ${card.title}`}
        onClick={() => onDismiss(card.id)}
        className="absolute right-3 top-3 z-10 flex size-5 items-center justify-center"
        style={{ color: "var(--muted-foreground)" }}
      >
        <X className="size-3.5" />
      </button>
      <div
        className="flex h-28 items-center justify-center"
        style={{ background: card.tint }}
      >
        <div
          className="flex size-12 items-center justify-center rounded-xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <Icon
            className="size-6"
            style={{ color: "var(--foreground)" }}
            strokeWidth={1.5}
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-2 p-5">
        <h2
          className="pr-5 text-[14px] font-semibold leading-snug"
          style={{ color: "var(--card-foreground)" }}
        >
          {card.title}
        </h2>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          {card.description}
        </p>
        {card.bullets && (
          <ul className="flex flex-col gap-0.5">
            {card.bullets.map((b) => (
              <li
                key={b}
                className="flex items-center gap-1.5 text-[12px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Check className="size-3" style={{ color: "var(--primary)" }} />
                {b}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-1">
          {card.href ? (
            <Link
              href={card.href}
              className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {card.action}
              <ArrowUpRight className="size-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md px-3 text-[12px] font-medium hover:bg-[var(--muted)]"
              style={{
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
              }}
            >
              {card.action}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function OverviewPage() {
  const [feed, setFeed] = React.useState(initialFeed);
  const [message, setMessage] = React.useState("");
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning!"
      : hour < 17
        ? "Good afternoon!"
        : "Good evening!";
  return (
    <main
      className="flex min-h-full flex-col"
      style={{ background: "var(--background)" }}
    >
      <StatsBar />
      <div className="flex flex-col px-6 py-6">
        <header className="pb-4 text-center">
          <h1
            className="text-[20px] font-semibold leading-snug"
            style={{ color: "var(--foreground)" }}
          >
            {greeting} Let&apos;s continue growing your business.
          </h1>
          <p
            className="mx-auto mt-1.5 max-w-[480px] text-[13px] leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Get a quick view of your store and keep moving forward with these
            recommended tasks.
          </p>
        </header>
        <section
          aria-label="Sidekick"
          className="rounded-xl p-4"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <Sparkles className="size-4" />
            </span>
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Work with Sidekick
            </span>
          </div>
          <div
            className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ border: "1px solid var(--input)" }}
          >
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask Sidekick anything about your store"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
            {[
              { icon: Paperclip, label: "Add files" },
              { icon: Mic, label: "Dictate" },
              { icon: Send, label: "Send" },
            ].map(({ icon: Icon, label }, i) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                disabled={i === 2 && !message.trim()}
                className="flex size-7 items-center justify-center rounded-md disabled:opacity-40"
                style={
                  i === 2
                    ? {
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }
                    : { color: "var(--muted-foreground)" }
                }
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-[12px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            Recents
          </button>
        </section>
        <section
          aria-label="Recommended tasks"
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          {feed.map((card) => (
            <FeedArticle
              key={card.id}
              card={card}
              onDismiss={(id) =>
                setFeed((cur) => cur.filter((c) => c.id !== id))
              }
            />
          ))}
        </section>
        {feed.length === 0 && (
          <section
            className="mt-5 rounded-xl p-10 text-center"
            style={{
              border: "1px dashed var(--border)",
              background: "var(--card)",
            }}
          >
            <Check
              className="mx-auto size-8"
              style={{ color: "var(--primary)" }}
            />
            <h2
              className="mt-3 text-[14px] font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              You&apos;re all caught up
            </h2>
            <p
              className="mt-1 text-[13px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              There are no recommended tasks right now.
            </p>
          </section>
        )}

        <Button
          variant="outline"
          onClick={() => toast.add({ title: "Event has been created." })}
        >
          Test
        </Button>
      </div>
    </main>
  );
}
