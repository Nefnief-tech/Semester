"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { useConsentStore } from "@/lib/store/consent";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";

/**
 * Consent banner (DSGVO): informs about the local-first storage that keeps
 * Semester running and asks before any third-party service may load. The
 * decision is stored on the device and can be changed from /privacy.
 */
export default function CookieBanner() {
  const hydrated = useHydrated();
  const t = useT();
  const decided = useConsentStore((s) => s.decided);
  const decide = useConsentStore((s) => s.decide);

  if (!hydrated || decided) return null;

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
          <button
            className="btn-ghost px-3 py-2 text-xs"
            onClick={() => decide(false)}
          >
            {t("Only essential")}
          </button>
          <button className="btn-primary px-3 py-2 text-xs" onClick={() => decide(true)}>
            {t("Allow everything")}
          </button>
        </div>
      </div>
    </div>
  );
}
