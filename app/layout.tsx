import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";

import { MotionProvider } from "@/components/motion-provider";
import { Nav } from "@/components/nav";
import { SystemBar } from "@/components/system-bar";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${grotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <MotionProvider>
          <div className="flex min-h-screen">
            <Nav />
            <div className="flex min-w-0 flex-1 flex-col">
              <SystemBar />
              <main className="flex-1 p-5">{children}</main>
            </div>
          </div>
          <Toaster position="bottom-right" />
        </MotionProvider>
      </body>
    </html>
  );
}
