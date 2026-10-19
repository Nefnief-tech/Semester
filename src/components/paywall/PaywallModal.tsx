"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Infinity as InfinityIcon, Rocket, Sparkles, X } from "lucide-react";
import { useSettingsStore } from "@/lib/store/settings";
import { useT } from "@/lib/i18n";

/**
 * One-time Pro pitch for the web app, fullscreen. Nothing is gated — the
 * only state is settings.proPitchSeen: shown once per device ~1.2 s into
 * the dashboard, then never again on this browser.
 */

const BENEFITS = [
  {
    Icon: InfinityIcon,
    key: "Every feature, no limits",
    sub: "Tasks, homework, grades, timetable, calendar and the AI study room — everything, on every device.",
  },
  {
    Icon: Sparkles,
    key: "AI study room included",
    sub: "Grounded answers that cite your documents, flashcard decks that build themselves.",
  },
  {
    Icon: Rocket,
    key: "Early access to new features",
    sub: "Spaced repetition, exports and more — you get them first.",
  },
  {
    Icon: Heart,
    key: "No ads, ever",
    sub: "No trackers, nothing sold — your desk stays yours.",
  },
];

const PLANS = [
  { id: "monthly", label: "Monthly", price: "9,99 €", note: "per month", blurb: "cancel anytime", highlight: false },
  { id: "yearly", label: "Yearly", price: "90 €", note: "per year", blurb: "save 25%", highlight: true },
];

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

  // every exit path (CTA, X, Escape) lands here and marks seen
  const dismiss = useCallback(() => {
    setOpen(false);
    setProPitchSeen();
  }, [setProPitchSeen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="Semester Pro"
    >
      <button
        onClick={dismiss}
        className="btn-icon fixed right-5 top-5"
        aria-label="Close"
      >
        <X className="size-4" />
      </button>

      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-14">
        <p className="font-mono text-[10px] tracking-[0.18em] text-accent uppercase">
          Semester Pro
        </p>
        <h2 className="mt-3 font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
          {t("One price, everything unlocked.")}
        </h2>

        <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {BENEFITS.map(({ Icon, key, sub }) => (
            <div key={key} className="flex items-start gap-3.5">
              <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t(key)}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{t(sub)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={
                plan.highlight
                  ? "relative rounded-xl border border-accent bg-accent/[0.06] p-4"
                  : "relative rounded-xl border border-line p-4"
              }
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] text-paper">
                  {t("best value")}
                </span>
              )}
              <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                {t(plan.label)}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
                {plan.price}
                <span className="ml-1.5 font-mono text-xs font-normal text-ink-soft">
                  {t(plan.note)}
                </span>
              </p>
              <p
                className={
                  plan.highlight
                    ? "mt-1 flex items-center gap-1 font-mono text-[11px] text-accent"
                    : "mt-1 font-mono text-[11px] text-ink-soft"
                }
              >
                {t(plan.blurb)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row-reverse">
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
      </div>
    </div>
  );
}
