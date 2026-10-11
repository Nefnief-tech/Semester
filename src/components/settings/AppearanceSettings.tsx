"use client";

import { useSyncExternalStore } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { ACCENTS, DESIGNS, isDarkMode, onModeChange, setDarkMode } from "@/lib/appearance";
import { useSettingsStore } from "@/lib/store/settings";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Appearance settings on the account page: color mode, design language and
 * accent color. Design + accent live in the settings store (device-level,
 * like the Bundesland) and reach the CSS as data attributes via
 * AppearanceSync; mode keeps the pre-paint `.dark` mechanism.
 */
export default function AppearanceSettings() {
  const t = useT();
  const design = useSettingsStore((s) => s.design);
  const accent = useSettingsStore((s) => s.accent);
  const setDesign = useSettingsStore((s) => s.setDesign);
  const setAccent = useSettingsStore((s) => s.setAccent);

  const dark = useSyncExternalStore(onModeChange, isDarkMode, () => false);

  const accentColor = ACCENTS.find((a) => a.id === accent)?.light ?? ACCENTS[0].light;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card px-5 py-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        <Palette className="size-4 text-accent" /> {t("Appearance")}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        {t("Color mode, design language and accent — applied instantly, stays on this device.")}
      </p>

      {/* ---------- color mode ---------- */}
      <span className="label mt-4">{t("Color mode")}</span>
      <div className="mt-1 grid grid-cols-2 gap-1 border border-line bg-paper-deep/60 p-1" style={{ borderRadius: "var(--radius-field)" }}>
        {[
          { active: !dark, label: t("Light"), icon: Sun, set: () => setDarkMode(false) },
          { active: dark, label: t("Dark"), icon: Moon, set: () => setDarkMode(true) },
        ].map(({ active, label, icon: Icon, set }) => (
          <button
            key={label}
            onClick={set}
            aria-pressed={active}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
              active
                ? "bg-card text-ink shadow-sm"
                : "text-ink-soft hover:text-ink",
            )}
            style={{ borderRadius: "calc(var(--radius-field) - 3px)" }}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ---------- design language ---------- */}
      <span className="label mt-5">{t("Design language")}</span>
      <div className="mt-1 grid grid-cols-2 gap-2.5">
        {DESIGNS.map((d) => {
          const active = design === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDesign(d.id)}
              aria-pressed={active}
              className={cn(
                "cursor-pointer rounded-xl border p-2 text-left transition",
                active
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-line hover:border-ink/30",
              )}
            >
              {/* mini mockup: paper, a card, type roles, shapes, accent */}
              <span
                className="block border p-2"
                style={{ background: d.preview.paper, borderColor: d.preview.line, borderRadius: d.preview.radius }}
              >
                <span
                  className="block border p-1.5"
                  style={{ background: d.preview.card, borderColor: d.preview.line, borderRadius: d.preview.radius }}
                >
                  <span className="flex items-center justify-between">
                    <span
                      style={{ fontFamily: d.preview.display, color: d.preview.ink, fontWeight: 600, fontSize: 13, lineHeight: 1 }}
                    >
                      Aa
                    </span>
                    <span className="size-2 rounded-full" style={{ background: accentColor }} />
                  </span>
                  <span className="mt-1.5 block space-y-1">
                    <span className="block h-[3px] w-4/5 rounded-full" style={{ background: d.preview.soft, opacity: 0.45 }} />
                    <span className="block h-[3px] w-3/5 rounded-full" style={{ background: d.preview.soft, opacity: 0.3 }} />
                  </span>
                  <span className="mt-2 flex items-center gap-1">
                    <span className="inline-block h-3 w-8" style={{ background: accentColor, borderRadius: d.preview.pill }} />
                    <span
                      className="inline-block h-3 w-5 border"
                      style={{ borderColor: d.preview.line, borderRadius: d.preview.pill }}
                    />
                  </span>
                </span>
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-[13px] font-medium">
                {d.name}
                {active && <Check className="size-3.5 text-accent" />}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{t(d.tagline)}</span>
            </button>
          );
        })}
      </div>

      {/* ---------- accent color ---------- */}
      <span className="label mt-5">{t("Accent color")}</span>
      <div className="mt-1 flex flex-wrap items-center gap-2.5">
        {ACCENTS.map((a) => {
          const active = accent === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              aria-pressed={active}
              aria-label={t(a.name)}
              title={t(a.name)}
              className={cn(
                "grid size-8 cursor-pointer place-items-center rounded-full transition",
                active ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-card" : "hover:scale-110",
              )}
              style={{ background: a.light }}
            >
              {active && <Check className="size-3.5 text-white/90" />}
            </button>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-soft">
        {t("design and accent apply to the whole app - the landing page keeps its own look.")}
      </p>
    </section>
  );
}
