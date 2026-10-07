"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { GradeEntry, Subject } from "@/lib/types";
import {
  cn,
  formatPoints,
  POINTS_TABLE,
  pointsToGrade,
  weightedAverage,
  weightSum,
} from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { GradeBadge, SubjectDot } from "@/components/ui/bits";

export default function SubjectCard({
  subject,
  entries,
  onEditSubject,
  onDeleteSubject,
  onAddGrade,
  onEditGrade,
}: {
  subject: Subject;
  entries: GradeEntry[];
  onEditSubject: (s: Subject) => void;
  onDeleteSubject: (s: Subject) => void;
  onAddGrade: (subjectId: string) => void;
  onEditGrade: (entry: GradeEntry) => void;
}) {
  const t = useT();
  const avg = weightedAverage(entries);
  const wSum = weightSum(entries);

  return (
    <section className="card flex flex-col overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-4">
        <SubjectDot color={subject.color} className="size-3" />
        <h2 className="font-display text-lg font-semibold tracking-tight">{subject.name}</h2>
        <div className="ml-auto flex gap-0.5">
          <button
            className="btn-icon size-7"
            aria-label={`Edit ${subject.name}`}
            onClick={() => onEditSubject(subject)}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            className="btn-icon size-7 hover:text-marker"
            aria-label={`Delete ${subject.name}`}
            onClick={() => onDeleteSubject(subject)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="flex items-end justify-between gap-4 px-5 pt-4 pb-3">
        <div>
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            Schnitt
          </span>
          <p className="font-display text-4xl leading-tight font-semibold tracking-tight">
            {avg === null ? "-" : formatPoints(avg)}
            {avg !== null && (
              <span className="ml-1 font-mono text-sm text-ink-soft">Pkt.</span>
            )}
          </p>
        </div>
        {entries.length > 1 && <Trend points={entries.map((e) => e.points)} />}
        {avg !== null && <GradeBadge points={avg} big />}
      </div>
      <p className="px-5 pb-3 font-mono text-[11px] text-ink-soft">
        {entries.length} {entries.length === 1 ? t("grade") : t("grades")} · {t("Σ weight")}{" "}
        <span className={cn(entries.length > 0 && wSum !== 100 && "text-amber")}>{wSum}</span>
        {entries.length > 0 && wSum !== 100 && ` ${t("(relative)")}`}
      </p>

      {entries.length > 0 && (
        <ul className="border-t border-line">
          {entries.map((e) => {
            const { grade, tone } = pointsToGrade(e.points);
            return (
              <li key={e.id}>
                <button
                  onClick={() => onEditGrade(e)}
                  className="grid w-full cursor-pointer grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors hover:bg-ink/[0.03]"
                >
                  <span className="truncate">
                    {e.title}
                    {e.date && (
                      <span className="ml-2 font-mono text-[10px] text-ink-soft">{e.date.slice(5)}</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">
                    {e.points} Pkt
                  </span>
                  <span className="chip font-mono text-[10px]">×{e.weight}</span>
                  <span
                    className={cn(
                      "text-right font-mono text-xs font-semibold",
                      tone === "good" && "text-accent",
                      tone === "ok" && "text-info",
                      tone === "warn" && "text-amber",
                      tone === "bad" && "text-marker",
                    )}
                  >
                    {grade}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <TargetRow avg={avg} wSum={wSum} entries={entries} />
      )}

      <footer className="mt-auto border-t border-line p-3">
        <button
          className="btn-ghost w-full border-dashed"
          onClick={() => onAddGrade(subject.id)}
        >
          <Plus className="size-4" /> {t("Add grade")}
        </button>
      </footer>
    </section>
  );
}

/** tiny sparkline of the grade history, 15 Pkt. at the top */
function Trend({ points }: { points: number[] }) {
  const w = 88;
  const h = 30;
  const pad = 3;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  // invert: high points sit high on the chart
  const y = (p: number) => h - pad - (p / 15) * (h - 2 * pad);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden className="ml-auto shrink-0 overflow-visible">
      <line
        x1={pad}
        y1={y(0)}
        x2={w - pad}
        y2={y(0)}
        className="stroke-line"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path
        d={d}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent"
      />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="2.5" className="fill-accent" />
    </svg>
  );
}

/** "Was brauche ich für eine 2,0?" — required points on the next grade */
function TargetRow({
  avg,
  wSum,
  entries,
}: {
  avg: number | null;
  wSum: number;
  entries: GradeEntry[];
}) {
  const t = useT();
  const [target, setTarget] = useState(12);
  // assume the next grade carries the typical weight of this subject's grades
  const w = Math.max(
    1,
    Math.round(entries.reduce((s, e) => s + e.weight, 0) / Math.max(1, entries.length)),
  );

  const needed =
    avg === null ? null : (target * (wSum + w) - avg * wSum) / w;
  const reachable = needed !== null && needed <= 15;
  const already = needed !== null && needed <= 0;
  const rounded = needed === null ? null : Math.ceil(needed);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line px-5 py-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase">{t("Target grade")}</span>
        <select
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="chip cursor-pointer bg-card py-0.5 font-mono text-[11px]"
        >
          {[...POINTS_TABLE].reverse().map((row) => (
            <option key={row.points} value={row.points}>
              {row.grade} ({row.points} Pkt.)
            </option>
          ))}
        </select>
      </label>
      {needed !== null && (
        <p
          className={cn(
            "ml-auto text-xs font-medium",
            already && "text-accent",
            !already && reachable && needed <= 13 && "text-accent",
            !already && reachable && needed > 13 && "text-amber",
            !reachable && "text-marker",
          )}
        >
          {already
            ? t("already above target")
            : reachable && rounded !== null
              ? t("next grade at weight {w}: at least {p} pts ({g})")
                  .replace("{w}", String(w))
                  .replace("{p}", String(rounded))
                  .replace("{g}", pointsToGrade(rounded).grade)
              : t("not reachable any more")}
        </p>
      )}
    </div>
  );
}
