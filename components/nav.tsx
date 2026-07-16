"use client";

import { motion } from "framer-motion";
import { Activity, Inbox, Receipt, Cpu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { fadeUp, staggerContainer } from "@/components/motion";
import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: Activity },
  { href: "/queue", label: "Review queue", icon: Inbox },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/model", label: "Model", icon: Cpu },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar flex h-full flex-col gap-1 p-3 md:w-56">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2 pt-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold text-background"
          style={{ backgroundColor: "var(--series)", fontFamily: "var(--font-heading)" }}
        >
          S
        </span>
        <span
          className="text-[15px] font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Sentinel
        </span>
      </Link>

      <motion.div
        className="flex flex-col gap-1"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <MotionLink
              key={href}
              href={href}
              variants={fadeUp}
              whileHover={{ x: 3, transition: { duration: 0.18 } }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </MotionLink>
          );
        })}
      </motion.div>

      <div className="mt-auto hidden px-2.5 pb-2 md:block">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Replaying held-out transactions the model never trained on.
        </p>
      </div>
    </nav>
  );
}
