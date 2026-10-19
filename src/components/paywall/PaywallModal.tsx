"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useSettingsStore } from "@/lib/store/settings";
import { useT } from "@/lib/i18n";

/**
 * One-time Pro pitch for the web app. Nothing is gated — the only state is
 * settings.proPitchSeen: shown once per device ~1.2 s into the dashboard,
 * then never again on this browser.
 */
export default function PaywallModal() {
  const t = useT();
  const seen = useSettingsStore((s) => s.proPitchSeen);
  const setProPitchSeen = useSettingsStore((s) => s.setProPitchSeen);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (seen) return;
    const timer = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(timer);
  }, [seen]);

  // every exit path (CTA, backdrop, Escape, X) lands here and marks seen
  const dismiss = () => {
    setOpen(false);
    setProPitchSeen();
  };

  return (
    <Modal open={open} onClose={dismiss} title="Semester Pro">
      <p className="-mb-2 text-sm text-ink-soft">
        {t("One price, everything unlocked.")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            {t("Monthly")}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
            9,99 €
            <span className="ml-1.5 font-mono text-xs font-normal text-ink-soft">
              {t("per month")}
            </span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-soft">
            {t("cancel anytime")}
          </p>
        </div>
        <div className="relative rounded-xl border border-accent bg-accent/[0.06] p-4">
          <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-paper">
            {t("best value")}
          </span>
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            {t("Yearly")}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
            90 €
            <span className="ml-1.5 font-mono text-xs font-normal text-ink-soft">
              {t("per year")}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-[11px] text-accent">
            <Check className="size-3" /> {t("save 25%")}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          onClick={dismiss}
          className="flex-1 cursor-pointer rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
        >
          {t("Got it")}
        </button>
        <button
          onClick={dismiss}
          className="flex-1 cursor-pointer rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-paper-deep"
        >
          {t("Continue free")}
        </button>
      </div>
    </Modal>
  );
}
