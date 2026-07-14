"use client";

import { Activity, Inbox, Receipt, Cpu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/queue", label: "Review queue", icon: Inbox },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/model", label: "Model", icon: Cpu },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3 md:w-56">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 pt-2">
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

      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
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
          </Link>
        );
      })}

      <div className="mt-auto hidden px-2.5 pb-2 md:block">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Replaying held-out transactions the model never trained on.
        </p>
      </div>
    </nav>
  );
}
