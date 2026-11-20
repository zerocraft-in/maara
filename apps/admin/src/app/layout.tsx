import type { Metadata, Viewport } from "next";
import type * as React from "react";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";

import { Toaster } from "@/components/ui/toast";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MAARA MERCH",
    template: "%s · Maara Merch",
  },
  description:
    "Retail management for clothing businesses — stock, purchasing, sales and finance in one place.",
  applicationName: "Maara Merch",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e10" },
  ],
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body className="relative min-h-dvh bg-sidebar font-sans text-[13px] leading-5 overscroll-none text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
