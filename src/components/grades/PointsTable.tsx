"use client";

import { POINTS_TABLE } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/** the full Oberstufe translation: Punkte ↔ classic +/− grades */
export default function PointsTable() {
  const t = useT();
  return (
    <details className="card mb-8 px-5 py-4">
      <summary className="cursor-pointer font-display text-base font-semibold tracking-tight">
        {t("Punkte → Noten")}{" "}
        <span className="font-normal text-ink-soft">({t("0-15 translated to 6-1 with +/-")})</span>
      </summary>
      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {POINTS_TABLE.map(({ points, grade, note }) => (
          <div
            key={points}
            className="rounded-lg border border-line bg-paper px-2 py-2 text-center"
          >
            <div className="font-mono text-sm font-semibold">{points}</div>
            <div className="font-mono text-[11px] text-accent">{grade}</div>
            <div className="mt-0.5 text-[10px] leading-tight text-ink-soft">{note}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-soft">
        {t("every whole grade spans 3 points: 3 · 2 · 1 = 5+ · 5 · 5-, 4 points (4-) still passes, 3 points (5+) does not.")}
      </p>
    </details>
  );
}
