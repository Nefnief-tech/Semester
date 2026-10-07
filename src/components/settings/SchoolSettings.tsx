"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Archive, CalendarRange, Check, Download, Map, Trash2 } from "lucide-react";
import { BUNDESLAENDER, holidayInfo, nextFerien } from "@/lib/holidays";
import { nextSchoolYear, useSettingsStore } from "@/lib/store/settings";
import { useArchiveStore, type YearArchive } from "@/lib/store/archive";
import { useSubjectsStore } from "@/lib/store/subjects";
import { useTodosStore } from "@/lib/store/todos";
import { useHomeworkStore } from "@/lib/store/homework";
import { useGradesStore } from "@/lib/store/grades";
import { useEventsStore } from "@/lib/store/events";
import { useTimetableStore } from "@/lib/store/timetable";
import { useDateLocale, useT } from "@/lib/i18n";
import { formatPoints, uid, weightedAverage } from "@/lib/utils";
import Modal from "@/components/ui/Modal";
import { SubjectDot } from "@/components/ui/bits";

/**
 * School settings on the account page: the Bundesland (drives Ferien &
 * Feiertage everywhere) and the school year with the Schuljahreswechsel —
 * archive the finished year on this device, download a JSON backup, then
 * reset the year-bound stores. Subjects carry over; the archive itself stays
 * local (the cloud syncs the active year), the backup is the portable copy.
 */
export default function SchoolSettings() {
  const t = useT();
  const dateLocale = useDateLocale();
  const bundesland = useSettingsStore((s) => s.bundesland);
  const schoolYear = useSettingsStore((s) => s.schoolYear);
  const setBundesland = useSettingsStore((s) => s.setBundesland);
  const archives = useArchiveStore((s) => s.archives);
  const removeArchive = useArchiveStore((s) => s.removeArchive);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const today = new Date();
  const outToday = bundesland ? holidayInfo(today, bundesland) : null;
  const ferien = bundesland ? nextFerien(today, bundesland) : null;

  return (
    <div className="mt-6 space-y-4">
      {/* ---------- bundesland ---------- */}
      <section className="rounded-2xl border border-line bg-card px-5 py-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <Map className="size-4 text-accent" /> {t("Bundesland")}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          {t("Ferien and Feiertage show up in the calendar, on the desk and next to your timetable. Stays on this device.")}
        </p>
        <select
          className="field mt-3"
          value={bundesland}
          onChange={(e) => setBundesland(e.target.value)}
          aria-label={t("Bundesland")}
        >
          <option value="">{t("not set, no holidays shown")}</option>
          {BUNDESLAENDER.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
        {outToday && (
          <p className="mt-3 rounded-xl border border-amber/40 bg-amber/[0.07] px-3 py-2 text-[13px]">
            <span className="font-medium">{t("Today")}</span>
            <span className="text-ink-soft"> · {outToday.name}</span>
            {outToday.end && (
              <span className="text-ink-soft">
                {" "}
                ({t("until")}{" "}
                {format(new Date(`${outToday.end}T12:00:00`), "d. MMM", { locale: dateLocale })})
              </span>
            )}
          </p>
        )}
        {!outToday && ferien && (
          <p className="mt-3 font-mono text-[10px] tracking-wide text-ink-soft">
            {t("next:")} {ferien.name} {t("in {n} days").replace("{n}", String(ferien.daysUntil))} ·{" "}
            {format(new Date(`${ferien.start}T12:00:00`), "d.M.", { locale: dateLocale })}–
            {format(new Date(`${ferien.end}T12:00:00`), "d.M.", { locale: dateLocale })}
          </p>
        )}
      </section>

      {/* ---------- school year ---------- */}
      <section className="rounded-2xl border border-line bg-card px-5 py-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <CalendarRange className="size-4 text-accent" /> {t("School year")}
        </h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="chip border-accent/40 bg-accent/10 font-mono text-accent">
            {schoolYear}
          </span>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setWizardOpen(true)}>
            <CalendarRange className="size-3.5" /> {t("Start the next school year")}
          </button>
        </div>

        {archives.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
              <Archive className="size-3" /> {t("Archived years")}
            </p>
            {archives
              .slice()
              .sort((a, b) => b.archivedAt - a.archivedAt)
              .map((a) => (
                <ArchiveRow
                  key={a.id}
                  archive={a}
                  expanded={expanded === a.id}
                  onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                  onDelete={() => {
                    if (
                      window.confirm(
                        t("Delete this archive? The JSON backup file stays on your device."),
                      )
                    )
                      removeArchive(a.id);
                  }}
                />
              ))}
          </div>
        )}

        {archives.length === 0 && (
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-ink-soft">
            {t(
              "finished a school year? archive it here and start fresh - grades, homework, events and tasks move into the archive, subjects stay.",
            )}
          </p>
        )}
      </section>

      {wizardOpen && <SchoolYearWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}

/* ---------------- school year wizard ---------------- */

function SchoolYearWizard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const current = useSettingsStore((s) => s.schoolYear);
  const gradeCount = useGradesStore((s) => s.entries).length;
  const homeworkCount = useHomeworkStore((s) => s.homeworks).length;
  const eventCount = useEventsStore((s) => s.events).length;
  const todoCount = useTodosStore((s) => s.todos).length;
  const timetableCount = useTimetableStore((s) => s.entries).length;
  const [next, setNext] = useState(() => nextSchoolYear(current));
  const [resetG, setResetG] = useState(true);
  const [resetH, setResetH] = useState(true);
  const [resetE, setResetE] = useState(true);
  const [resetT, setResetT] = useState(true);
  const [resetTimetable, setResetTimetable] = useState(false);
  const [done, setDone] = useState(false);

  /** full snapshot of every store — the portable safety net before any reset */
  const downloadBackup = () => {
    const s = useSettingsStore.getState();
    const backup = {
      app: "semester",
      kind: "school-year-backup",
      createdAt: new Date().toISOString(),
      schoolYear: s.schoolYear,
      subjects: useSubjectsStore.getState().subjects,
      todos: useTodosStore.getState().todos,
      homework: useHomeworkStore.getState().homeworks,
      grades: useGradesStore.getState().entries,
      events: useEventsStore.getState().events,
      timetable: useTimetableStore.getState().entries,
      archives: useArchiveStore.getState().archives,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `semester-backup-${backup.schoolYear.replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const start = () => {
    const label = current;
    const grades = useGradesStore.getState().entries;
    const homework = useHomeworkStore.getState().homeworks;
    const events = useEventsStore.getState().events;
    const todos = useTodosStore.getState().todos;
    const archive: YearArchive = {
      id: uid(),
      label,
      archivedAt: Date.now(),
      grades: resetG ? grades : [],
      homework: resetH ? homework : [],
      events: resetE ? events : [],
      todos: resetT ? todos : [],
    };
    if (resetG || resetH || resetE || resetT) useArchiveStore.getState().addArchive(archive);
    downloadBackup();
    if (resetG) useGradesStore.getState().clearAll();
    if (resetH) useHomeworkStore.getState().clearAll();
    if (resetE) useEventsStore.getState().clearAll();
    if (resetT) useTodosStore.getState().clearAll();
    if (resetTimetable) useTimetableStore.getState().clear();
    useSettingsStore.getState().setSchoolYear(next.trim() || nextSchoolYear(current));
    setDone(true);
  };

  const resets = [
    { on: resetG, set: setResetG, label: t("Grades"), count: gradeCount },
    { on: resetH, set: setResetH, label: t("Homework"), count: homeworkCount },
    { on: resetE, set: setResetE, label: t("Calendar"), count: eventCount },
    { on: resetT, set: setResetT, label: t("Tasks"), count: todoCount },
  ];

  return (
    <Modal open onClose={onClose} title={t("Start the next school year")}>
      {done ? (
        <div>
          <p className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm">
            <Check className="size-4 shrink-0 text-accent" />
            {t("Fresh start: the archive holds the finished year, the backup is in your downloads.")}
          </p>
          <button className="btn-primary mt-4 w-full" onClick={onClose}>
            {t("Close")}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {t(
              "The finished year is archived on this device and a JSON backup downloads first. Subjects stay; pick what starts empty:",
            )}
          </p>
          <div className="mt-3 space-y-1.5">
            {resets.map(({ on, set, label, count }) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
              >
                <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
                <span className="flex-1">{label}</span>
                <span className="font-mono text-[10px] text-ink-soft">{count}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={resetTimetable}
                onChange={(e) => setResetTimetable(e.target.checked)}
              />
              <span className="flex-1">{t("Timetable")}</span>
              <span className="font-mono text-[10px] text-ink-soft">{timetableCount}</span>
            </label>
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="new-school-year">
              {t("New school year")}
            </label>
            <input
              id="new-school-year"
              className="field"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={nextSchoolYear(current)}
            />
          </div>
          <button className="btn-primary mt-5 w-full" onClick={start} disabled={!next.trim()}>
            <Download className="size-4" /> {t("Archive & start fresh")}
          </button>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-soft">
            {t("the archive lives on this device only, keep the downloaded backup somewhere safe.")}
          </p>
        </>
      )}
    </Modal>
  );
}

/* ---------------- archive row ---------------- */

function ArchiveRow({
  archive,
  expanded,
  onToggle,
  onDelete,
}: {
  archive: YearArchive;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const dateLocale = useDateLocale();
  const subjects = useSubjectsStore((s) => s.subjects);
  const overall = useMemo(() => weightedAverage(archive.grades), [archive.grades]);

  const perSubject = useMemo(
    () =>
      subjects
        .map((s) => ({
          subject: s,
          avg: weightedAverage(archive.grades.filter((g) => g.subjectId === s.id)),
          count: archive.grades.filter((g) => g.subjectId === s.id).length,
        }))
        .filter((r) => r.count > 0),
    [archive.grades, subjects],
  );

  const orphanAvg = useMemo(
    () =>
      weightedAverage(
        archive.grades.filter((g) => !g.subjectId || !subjects.some((s) => s.id === g.subjectId)),
      ),
    [archive.grades, subjects],
  );
  const orphanCount = archive.grades.filter(
    (g) => !g.subjectId || !subjects.some((s) => s.id === g.subjectId),
  ).length;

  return (
    <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
      <div className="flex items-center gap-3">
        <button
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className="font-display text-base font-semibold tracking-tight">{archive.label}</span>
          <span className="ml-2 font-mono text-[10px] text-ink-soft">
            {format(new Date(archive.archivedAt), "d.M.yyyy", { locale: dateLocale })}
          </span>
          <span className="block font-mono text-[10px] text-ink-soft">
            {t("Grades")} {archive.grades.length} · {t("Homework")} {archive.homework.length} ·{" "}
            {t("entries")} {archive.events.length} · {t("tasks")} {archive.todos.length}
          </span>
        </button>
        {overall !== null && (
          <span className="font-mono text-sm font-semibold text-accent">
            Ø {formatPoints(overall)}
          </span>
        )}
        <button
          className="btn-icon text-ink-soft hover:text-marker"
          onClick={onDelete}
          aria-label={t("Delete")}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {expanded && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
          {perSubject.map(({ subject, avg, count }) => (
            <li key={subject.id} className="flex items-center gap-2 text-[13px]">
              <SubjectDot color={subject.color} />
              <span className="min-w-0 flex-1 truncate">{subject.name}</span>
              <span className="font-mono text-[10px] text-ink-soft">{count}×</span>
              <span className="w-10 text-right font-mono text-xs font-semibold">
                {avg === null ? "-" : formatPoints(avg)}
              </span>
            </li>
          ))}
          {orphanCount > 0 && (
            <li className="flex items-center gap-2 text-[13px] text-ink-soft">
              <SubjectDot color="#a49b88" />
              <span className="flex-1">{t("without subject")}</span>
              <span className="font-mono text-[10px]">{orphanCount}×</span>
              <span className="w-10 text-right font-mono text-xs font-semibold">
                {orphanAvg === null ? "-" : formatPoints(orphanAvg)}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
