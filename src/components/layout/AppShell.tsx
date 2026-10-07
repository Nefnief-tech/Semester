"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  BookOpen,
  CalendarDays,
  Calculator,
  LayoutDashboard,
  Search,
  Sparkles,
  SquareCheckBig,
  Table2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import { cn, formatClock } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { initSync, signOut } from "@/lib/auth/sync";
import { pingAppwrite } from "@/lib/auth/appwrite";
import { useAuthStore } from "@/lib/store/auth";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LangToggle from "@/components/ui/LangToggle";
import CommandPalette from "@/components/ui/CommandPalette";

const NAV: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/todos", label: "Tasks", icon: SquareCheckBig },
  { href: "/homework", label: "Homework", icon: BookOpen },
  { href: "/grades", label: "Grades", icon: Calculator },
  { href: "/timetable", label: "Timetable", icon: Table2 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/study-room", label: "Study Room", icon: Sparkles },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** the Semester star mark, inline so it inherits no requests */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <rect width="512" height="512" rx="96" fill="#31633f" />
      <g stroke="#f5f2ea" strokeWidth="34" strokeLinecap="round">
        <line x1="256" y1="128" x2="256" y2="384" />
        <line x1="143.6" y1="192" x2="368.4" y2="320" />
        <line x1="143.6" y1="320" x2="368.4" y2="192" />
      </g>
      <circle cx="256" cy="256" r="40" fill="#f5f2ea" />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuthStore();
  const t = useT();

  useEffect(() => {
    void initSync();
    pingAppwrite()
      .then((pong) => console.log("[Appwrite] ping ✓", pong))
      .catch((e) => console.warn("[Appwrite] ping failed:", e?.message ?? e));
  }, []);

  const current = NAV.find((n) => isActive(pathname, n.href));

  const syncLabel =
    auth.status === "loading"
      ? t("checking session…")
      : !auth.online
        ? t("offline, saved locally")
        : auth.syncing
          ? t("syncing…")
          : auth.syncError
            ? t("sync error")
            : auth.lastSyncedAt
              ? `${t("synced")} · ${formatClock(auth.lastSyncedAt)}`
              : t("not synced yet");

  // the marketing landing + docs render full-bleed — no sidebar, no top bar
  if (pathname === "/landing" || pathname.startsWith("/docs")) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      <CommandPalette />

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-paper px-5 py-7 md:flex">
        <Link href="/" className="group mb-9 flex items-center gap-3">
          <BrandMark className="size-9 rounded-[10px] shadow-[0_2px_8px_-2px_rgb(49_99_63/0.4)] transition-transform group-hover:scale-[1.04]" />
          <span>
            <span className="block font-display text-[22px] leading-none font-semibold tracking-tight">
              Semester
              <span className="text-accent">.</span>
            </span>
            <span className="mt-1 block font-mono text-[9px] tracking-[0.22em] text-ink-soft uppercase">
              {t("the study desk")}
            </span>
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-soft hover:bg-ink/5 hover:text-ink",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <Icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
                {t(label)}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
          }
          className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Search className="size-4" />
          {t("Quick menu")}
          <kbd className="ml-auto rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[9px]">
            ⌘K
          </kbd>
        </button>

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          {auth.status === "unconfigured" ? (
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10px] leading-relaxed text-ink-soft">
                {t("Data lives in your browser")}
                <br />
                {t("(localStorage), nothing")}
                <br />
                {t("leaves this device.")}
              </p>
              <div className="flex flex-col items-end gap-2">
                <LangToggle />
                <ThemeToggle />
              </div>
            </div>
          ) : auth.status === "signed-in" && auth.user ? (
            <div className="space-y-2.5">
              <Link
                href="/account"
                className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-ink/5"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <UserRound className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{auth.user.email}</p>
                  <p
                    className={cn(
                      "font-mono text-[10px]",
                      auth.syncError ? "text-marker" : "text-ink-soft",
                    )}
                  >
                    {syncLabel}
                  </p>
                </div>
              </Link>
              <div className="flex items-center justify-between">
                <LangToggle />
                <button
                  onClick={() => void signOut()}
                  className="cursor-pointer font-mono text-[10px] tracking-wide text-ink-soft uppercase transition-colors hover:text-marker"
                >
                  {t("sign out")}
                </button>
                <ThemeToggle />
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <Link href="/account" className="btn-ghost flex-1">
                <UserRound className="size-4" />
                {auth.status === "loading" ? t("checking…") : t("Sign in to sync")}
              </Link>
              <ThemeToggle />
            </div>
          )}
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <BrandMark className="size-6 rounded-md" />
          Semester<span className="text-accent">.</span>
        </Link>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[11px] tracking-[0.18em] text-ink-soft uppercase">
            {current?.label ?? "Overview"}
          </span>
          {auth.status !== "unconfigured" && (
            <Link
              href="/account"
              aria-label="Account"
              className={cn(
                "relative grid size-8 place-items-center rounded-lg transition-colors hover:bg-ink/5",
                auth.status === "signed-in" ? "text-accent" : "text-ink-soft",
              )}
            >
              <UserRound className="size-4" />
              {auth.status === "signed-in" && (
                <span
                  className={cn(
                    "absolute right-1 top-1 size-1.5 rounded-full",
                    auth.syncing || auth.syncError ? "bg-marker" : "bg-accent",
                  )}
                />
              )}
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* content on a faint planner grid */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-16">
          <div className="bg-[radial-gradient(var(--color-grid)_1px,transparent_1.5px)] [background-size:22px_22px]">
            {children}
          </div>
        </div>
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper/95 backdrop-blur md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors",
                active ? "font-medium text-accent" : "text-ink-soft",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              {t(label).split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
