"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, CreditCard, Globe2, Mic, Paperclip, Palette, Send, ShoppingBag, Sparkles, Store, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeedCard = { id: string; title: string; description: string; action: string; href?: string; icon: React.ElementType; accent: string; bullets?: string[] };

const metrics = [
  { label: "Sessions", value: "1", note: "vs. previous period" },
  { label: "Total sales", value: "₹0", note: "vs. previous period" },
  { label: "Orders", value: "0", note: "vs. previous period" },
  { label: "Conversion rate", value: "0%", note: "vs. previous period" },
];

const initialFeed: FeedCard[] = [
  { id: "dropshipping", title: "Learn the dropshipping basics", description: "See how to find products, build your store, and start selling.", action: "Watch now", icon: ShoppingBag, accent: "from-violet-100 to-indigo-50" },
  { id: "launch", title: "Launch your online store", description: "Ready to open for business? Take your store public and start welcoming customers.", action: "Launch store", href: "/settings", icon: Store, accent: "from-emerald-100 to-teal-50" },
  { id: "payments", title: "Set up payments", description: "Choose a payment provider to let customers pay by card or digital wallet.", action: "Activate payments", href: "/settings/payments", icon: CreditCard, accent: "from-blue-100 to-cyan-50" },
  { id: "domain", title: "Get maraapparels a matching domain", description: "We found domain names that match your store. Choose your favorite and make it yours.", action: "Choose a domain", href: "/settings/domains", icon: Globe2, accent: "from-amber-100 to-orange-50", bullets: ["maraapparels.com", "maraapparels.in", "maraapparels.net"] },
  { id: "shipping", title: "Review shipping rates", description: "Look over the shipping defaults based on your store location.", action: "Review rates", href: "/settings/shipping", icon: Truck, accent: "from-rose-100 to-pink-50" },
  { id: "homepage", title: "Boost conversion with a customized homepage", description: "Use your theme and apps to tailor the homepage for your customers.", action: "View guide", href: "/online-store", icon: Palette, accent: "from-fuchsia-100 to-purple-50" },
];

function FilterButton({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  return <Button variant="outline" className="h-9 gap-2 rounded-lg bg-background px-3 text-sm font-medium shadow-sm"><Icon className="size-4 text-muted-foreground" />{children}<ChevronDown className="ml-1 size-4 text-muted-foreground" /></Button>;
}

function MetricTile({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="rounded-xl border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></article>;
}

function FeedArticle({ card, onDismiss }: { card: FeedCard; onDismiss: (id: string) => void }) {
  const Icon = card.icon;
  return <article className="relative overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
    <button type="button" aria-label={`Dismiss ${card.title}`} onClick={() => onDismiss(card.id)} className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" /></button>
    <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${card.accent}`}><Icon className="size-12 stroke-[1.35] text-foreground/75" /></div>
    <div className="space-y-3 p-5"><h2 className="pr-6 text-base font-semibold tracking-tight">{card.title}</h2><p className="text-sm leading-6 text-muted-foreground">{card.description}</p>{card.bullets && <ul className="space-y-1 text-sm text-muted-foreground">{card.bullets.map((bullet) => <li key={bullet} className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{bullet}</li>)}</ul>}{card.href ? <Link href={card.href} className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">{card.action}<ArrowUpRight className="size-4" /></Link> : <Button variant="outline" size="sm">{card.action}</Button>}</div>
  </article>;
}

export default function OverviewPage() {
  const [feed, setFeed] = React.useState(initialFeed);
  const [message, setMessage] = React.useState("");

  return <main className="min-h-full bg-[#f6f6f7]">
    <div className="mx-auto w-full max-w-[980px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-end gap-2"><FilterButton icon={CalendarDays}>Last 30 days</FilterButton><FilterButton icon={Globe2}>All channels</FilterButton></div>
      <section aria-label="Store performance" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}</section>
      <Link href="/analytics" className="mt-4 inline-flex items-center gap-2 text-sm font-medium hover:underline"><span className="size-2 rounded-full bg-emerald-500" />Live visitors <span className="text-muted-foreground">0</span><ArrowUpRight className="size-4" /></Link>
      <header className="py-10 text-center sm:py-14"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hey there! Let&apos;s continue growing your business.</h1><p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Get a quick view of your store and keep moving forward with these recommended tasks.</p></header>
      <section aria-label="Sidekick" className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>Work with Sidekick</div><div className="mt-4 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask Sidekick anything about your store" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><button type="button" aria-label="Add files" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><Paperclip className="size-4" /></button><button type="button" aria-label="Dictate" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><Mic className="size-4" /></button><button type="button" aria-label="Send message" className="rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50" disabled={!message.trim()}><Send className="size-4" /></button></div><Button variant="ghost" size="sm" className="mt-2 text-muted-foreground">Recents</Button></section>
      <section aria-label="Recommended tasks" className="mt-6 grid gap-4 md:grid-cols-2">{feed.map((card) => <FeedArticle key={card.id} card={card} onDismiss={(id) => setFeed((current) => current.filter((item) => item.id !== id))} />)}</section>
      {feed.length === 0 && <section className="mt-6 rounded-xl border border-dashed bg-card p-10 text-center"><Check className="mx-auto size-8 text-emerald-600" /><h2 className="mt-3 font-semibold">You&apos;re all caught up</h2><p className="mt-1 text-sm text-muted-foreground">There are no recommended tasks right now.</p></section>}
    </div>
  </main>;
}
