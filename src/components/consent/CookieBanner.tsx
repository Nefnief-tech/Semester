"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import { useConsentStore } from "@/lib/store/consent";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { BrandMark } from "@/components/layout/AppShell";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";

/**
 * DSGVO consent gate: until the visitor decides, nothing mounts, no effect
 * runs and (via the storage guard) nothing persists — not a single key.
 * Inside the app the decision is a full-page screen; on the marketing pages
 * it's the bottom card so the landing stays readable. The decision lives on
 * the device and can be changed from /privacy.
 */
export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const decided = useConsentStore((s) => s.decided);
  const decide = useConsentStore((s) => s.decide);
  const pathname = usePathname();

  // marketing pages stay readable pre-decision — with the bottom card
  const fullBleed =
    pathname === "/landing" || pathname.startsWith("/docs") || pathname.startsWith("/privacy");

  if (!hydrated) return <>{children}</>;

  if (decided || fullBleed) {
    return (
      <>
        {children}
        <ServiceWorkerRegister />
        {!decided && <ConsentCard onDecide={decide} />}
      </>
    );
  }

  return <ConsentScreen onDecide={decide} />;
}

function ConsentScreen({ onDecide }: { onDecide: (external: boolean) => void }) {
  const t = useT();
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4 dark:bg-[#17150f]">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-card px-7 py-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9 rounded-[10px]" />
          <span className="font-display text-xl font-semibold tracking-tight">
            Semester<span className="text-accent">.</span>
          </span>
        </div>
        <h1 className="mt-5 font-display text-2xl leading-tight font-semibold tracking-tight">
          {t("One decision, then you're in.")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t("This desk keeps your data on your device.")}{" "}
          {t(
            "Tasks, grades and books are stored locally - no trackers, no ads, nothing leaves this device. External services load only after your ok.",
          )}{" "}
          <Link
            href="/privacy"
            className="underline decoration-line transition-colors hover:text-ink"
          >
            {t("Privacy")}
          </Link>
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button className="btn-ghost px-4 py-2 text-sm" onClick={() => onDecide(false)}>
            {t("Only essential")}
          </button>
          <button className="btn-primary px-4 py-2 text-sm" onClick={() => onDecide(true)}>
            {t("Allow everything")}
          </button>
        </div>
        <p className="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-ink-soft">
          <Cookie className="size-3" />
          {t("The choice itself is the only thing stored before you decide.")}
        </p>
      </div>
    </div>
  );
}

function ConsentCard({ onDecide }: { onDecide: (external: boolean) => void }) {
  const t = useT();
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 print:hidden"
      role="dialog"
      aria-modal="false"
      aria-label={t("Privacy")}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-card px-5 py-4 shadow-2xl sm:flex-row sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Cookie className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-soft">
          <p className="font-display text-sm font-semibold tracking-tight text-ink">
            {t("This desk keeps your data on your device.")}
          </p>
          <p>
            {t(
              "Tasks, grades and books are stored locally - no trackers, no ads, nothing leaves this device. External services load only after your ok.",
            )}{" "}
            <Link
              href="/privacy"
              className="underline decoration-line transition-colors hover:text-ink"
            >
              {t("Privacy")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button className="btn-ghost px-3 py-2 text-xs" onClick={() => onDecide(false)}>
            {t("Only essential")}
          </button>
          <button className="btn-primary px-3 py-2 text-xs" onClick={() => onDecide(true)}>
            {t("Allow everything")}
          </button>
        </div>
      </div>
    </div>
  );
}
