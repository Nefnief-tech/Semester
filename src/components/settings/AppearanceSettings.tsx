"use client";

import { useSyncExternalStore } from "react";
import { Check, Moon, Palette, Sun, type LucideIcon } from "lucide-react";
import {
  ACCENTS,
  DESIGNS,
  isDarkMode,
  onModeChange,
  setDarkMode,
  type Corners,
  type GridPattern,
  type MotionPref,
} from "@/lib/appearance";
import { useSettingsStore } from "@/lib/store/settings";
import { useAuthStore } from "@/lib/store/auth";
import { pushAppearance } from "@/lib/auth/appearance-sync";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Appearance settings on the account page: color mode, design language,
 * accent, corners, background pattern and motion. Everything lives in the
 * settings store (device-level, like the Bundesland) and reaches the CSS
 * as data attributes via AppearanceSync; mode keeps the pre-paint `.dark`
 * mechanism. With syncAppearance on, the look mirrors into the Appwrite
 * account prefs (see lib/auth/appearance-sync.ts).
 */
export default function AppearanceSettings() {
  const t = useT();
  const design = useSettingsStore((s) => s.design);
  const accent = useSettingsStore((s) => s.accent);
  const corners = useSettingsStore((s) => s.corners);
  const grid = useSettingsStore((s) => s.grid);
  const motion = useSettingsStore((s) => s.motion);
  const syncAppearance = useSettingsStore((s) => s.syncAppearance);
  const setDesign = useSettingsStore((s) => s.setDesign);
  const setAccent = useSettingsStore((s) => s.setAccent);
  const setCorners = useSettingsStore((s) => s.setCorners);
  const setGrid = useSettingsStore((s) => s.setGrid);
  const setMotion = useSettingsStore((s) => s.setMotion);
  const setSyncAppearance = useSettingsStore((s) => s.setSyncAppearance);

  const signedIn = useAuthStore((s) => s.status === "signed-in");
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

      <Segmented
        label={t("Color mode")}
        value={dark ? "dark" : "light"}
        onChange={(v) => setDarkMode(v === "dark")}
        options={[
          { value: "light", label: t("Light"), icon: Sun },
          { value: "dark", label: t("Dark"), icon: Moon },
        ]}
      />

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

      <Segmented<Corners>
        label={t("Corners")}
        value={corners}
        onChange={setCorners}
        options={[
          { value: "sharp", label: t("Sharp") },
          { value: "normal", label: t("Normal") },
          { value: "round", label: t("Rounded") },
        ]}
      />

      <Segmented<GridPattern>
        label={t("Background")}
        value={grid}
        onChange={setGrid}
        options={[
          { value: "dots", label: t("Dots") },
          { value: "lines", label: t("Lines") },
          { value: "none", label: t("None") },
        ]}
      />

      <Segmented<MotionPref>
        label={t("Motion")}
        value={motion}
        onChange={setMotion}
        options={[
          { value: "normal", label: t("Lively") },
          { value: "quiet", label: t("Quiet") },
        ]}
      />

      {/* ---------- opt-in account sync ---------- */}
      <div className="mt-5 border-t border-line pt-4">
        <label
          className={cn(
            "flex items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2 text-sm",
            signedIn ? "cursor-pointer" : "opacity-60",
          )}
        >
          <input
            type="checkbox"
            checked={syncAppearance}
            disabled={!signedIn}
            onChange={(e) => {
              setSyncAppearance(e.target.checked);
              // the toggle is a promise in both directions: on → push the
              // look up now, off → strip the blob from the account prefs;
              // everyday changes ride the debounced subscriber
              void pushAppearance().catch(() => {});
            }}
          />
          <span className="flex-1">{t("Sync appearance with your account")}</span>
        </label>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-ink-soft">
          {signedIn
            ? t("Design, accent, corners, background and motion are stored in your account preferences and pulled on every sign-in.")
            : t("Sign in to keep your look in sync across devices.")}
        </p>
      </div>

      <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-soft">
        {t("design and accent apply to the whole app - the landing page keeps its own look.")}
      </p>
    </section>
  );
}

/* ---------------- segmented control ---------------- */

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
  onChange: (v: T) => void;
}) {
  return (
    <>
      <span className="label mt-4">{label}</span>
      <div
        className="mt-1 grid gap-1 border border-line bg-paper-deep/60 p-1"
        style={{ borderRadius: "var(--radius-field)", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = value === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 px-2 py-1.5 text-xs transition-colors",
                active ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink",
              )}
              style={{ borderRadius: "calc(var(--radius-field) - 3px)" }}
            >
              {Icon && <Icon className="size-3.5" />} {o.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
