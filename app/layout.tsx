import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { MotionProvider } from "@/components/motion-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Three faces, three jobs: Grotesk states, Plex Sans explains, Plex Mono counts.
const grotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sentinel — fraud detection console",
  description:
    "Real-time payment fraud detection: transactions scored on arrival, the uncertain ones routed to a human.",
};

/**
 * Root layout: just the document shell, fonts, and app-wide providers. The
 * console chrome (sidebar + system bar) lives in the (console) route group so the
 * landing page can render full-bleed without it.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${grotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <MotionProvider>
          {children}
          <Toaster position="bottom-right" />
        </MotionProvider>
      </body>
    </html>
  );
}
