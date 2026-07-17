import { ConsoleBackdrop } from "@/components/console-backdrop";
import { Nav } from "@/components/nav";
import { SystemBar } from "@/components/system-bar";

/**
 * The console chrome: sidebar navigation and the system bar (live-stream status
 * + fraud-burst button). Wraps every operational page, but not the landing hero.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ConsoleBackdrop />
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col">
        <SystemBar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
