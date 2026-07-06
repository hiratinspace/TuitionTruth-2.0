import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { env } from "@/env";
import "@tuitiontruth/ui/tokens.css";
import "./globals.css";

// The tri-family type system (§3.1). The `variable` names must match the CSS
// custom properties referenced in tokens.css and tailwind.config.ts.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-plex-serif",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "TuitionTruth — what a degree actually costs",
    template: "%s | TuitionTruth",
  },
  description:
    "Track real college tuition, net price after aid, and how fast the number is rising. Every figure sourced and dated.",
  applicationName: "TuitionTruth",
  openGraph: {
    type: "website",
    siteName: "TuitionTruth",
    title: "TuitionTruth — what a degree actually costs",
    description:
      "Track real college tuition, net price after aid, and how fast the number is rising. Every figure sourced and dated.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable}`}>
      <body>
        {/* Skip link — first focusable element, visually hidden until focused. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius)] focus:bg-primary focus:px-4 focus:py-2 focus:font-body focus:text-sm focus:text-on-primary"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
