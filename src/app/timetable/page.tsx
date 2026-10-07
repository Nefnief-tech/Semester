"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eraser, Pencil, Plus, RefreshCcw, Table2, Upload, X } from "lucide-react";
import type { PortalPlan, PortalSub } from "@/lib/server/portal";
import { useTimetableStore } from "@/lib/store/timetable";
import { usePortalStore } from "@/lib/store/portal";
import { useSubjectsStore } from "@/lib/store/subjects";
import { useHydrated } from "@/lib/hooks";
import { syncPortalTestTasks } from "@/lib/portalTests";
import { timetableNow } from "@/lib/schedule";
import { holidayInfo } from "@/lib/holidays";
import { useSettingsStore } from "@/lib/store/settings";
import { currentLang, useT } from "@/lib/i18n";
import {
  DAY_ORDER,
  EXAMPLE_TIMETABLE,
  parseTimetable,
  timetableToJson,
} from "@/lib/timetable";
import { cn, PALETTE } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth/appwrite";
import { reconcilePortalSnapshot } from "@/lib/auth/sync";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { EmptyState, SubjectDot } from "@/components/ui/bits";
import LessonEditor, { type LessonSlot } from "@/components/timetable/LessonEditor";

const PORTAL_WEEKDAY: Record<string, string> = {
  mo: "Mon",
  di: "Tue",
  mi: "Wed",
  do: "Thu",
  fr: "Fri",
  sa: "Sat",
  so: "Sun",
};

/** periods a plan row covers: "3" → [3], "3 - 4" → [3, 4] (double lessons) */
function subPeriods(period: string): number[] {
  const range = period.match(/(\d+)\s*[-–/]\s*(\d+)/);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a)
      return Array.from({ length: Math.min(b - a + 1, 12) }, (_, i) => a + i);
  }
  const p = parseInt(period, 10);
  return Number.isFinite(p) ? [p] : [];
}

function subjectColor(name: string, names: Map<string, string>) {
  return names.get(name.toLowerCase()) ?? PALETTE[name.length % PALETTE.length];
}

export default function TimetablePage() {
  const hydrated = useHydrated();
  const entries = useTimetableStore((s) => s.entries);
  const setTimetable = useTimetableStore((s) => s.setTimetable);
  const clear = useTimetableStore((s) => s.clear);
  const subjects = useSubjectsStore((s) => s.subjects);
  const bundesland = useSettingsStore((s) => s.bundesland);

  const t = useT();
  const portal = usePortalStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  // edit mode: cells become clickable, the editor modal builds the grid.
  // /timetable?edit=1 (onboarding deep link) lands directly in edit mode.
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(() => searchParams.get("edit") === "1");
  const [slot, setSlot] = useState<LessonSlot | null>(null);

  // the current-lesson highlight follows the clock (30 s is plenty)
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const lessonNow = useMemo(
    () => timetableNow(entries, clock),
    [entries, clock],
  );
  /** a Feiertag or Ferien today means no lessons — the grid says so instead */
  const outToday = useMemo(() => holidayInfo(clock, bundesland), [clock, bundesland]);

  const subjectColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) map.set(s.name.toLowerCase(), s.color);
    return map;
  }, [subjects]);

  const days = useMemo(() => {
    if (!editing) return DAY_ORDER.filter((d) => entries.some((e) => e.day === d));
    // edit mode always offers Mon–Fri; Sat/Sun only when lessons exist there
    const base = DAY_ORDER.slice(0, 5);
    for (const d of ["Sat", "Sun"]) if (entries.some((e) => e.day === d)) base.push(d);
    return base;
  }, [editing, entries]);
  const periods = useMemo(() => {
    const set = new Set<number>();
    for (const e of entries) set.add(e.period);
    if (editing && set.size === 0) set.add(1);
    return [...set].sort((a, b) => a - b);
  }, [editing, entries]);

  const periodTime = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of entries) if (e.time && !map.has(e.period)) map.set(e.period, e.time);
    return map;
  }, [entries]);

  const todayCol = DAY_ORDER[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  /** substitute-plan entries that affect the grid. When the membership list
   *  ("Mitglied in Kursen") could not be scraped, all rows are shown rather
   *  than none. */
  const relevantSubs: PortalSub[] = useMemo(() => {
    if (!portal.data) return [];
    const all = portal.data.days.flatMap((d) => d.entries);
    const own = portal.data.courses.map((c) => c.trim()).filter(Boolean);
    return own.length ? all.filter((s) => own.includes(s.course.trim())) : all;
  }, [portal.data]);

  /** plan rows landing in one timetable cell: same weekday + overlapping
   *  period. The course code itself is not re-checked against the lesson —
   *  the timetable JSON may spell subjects differently ("Mathe" vs "2ph1"),
   *  and the membership filter already picked the student's own courses. */
  const cellSubsFor = (day: string, period: number) =>
    relevantSubs.filter(
      (s) =>
        PORTAL_WEEKDAY[(s.weekday ?? "").toLowerCase()] === day &&
        subPeriods(s.period).includes(period),
    );

  const load = (text: string) => {
    setError("");
    setWarnings([]);
    try {
      const { entries: parsed, warnings: warns } = parseTimetable(text);
      setTimetable(parsed);
      setWarnings(warns);
      if (warns.length === 0) setPanelOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fetchNow = async () => {
    if (fetching) return;
    setFetching(true);
    portal.setError(null);
    try {
      const res = await fetch("/api/portal/fetch", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          baseUrl: portal.baseUrl,
          username: portal.username,
          password: portal.password,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | PortalPlan
        | { error?: string; detail?: string }
        | null;
      if (!res.ok || !json || !("days" in json)) {
        const code = json && "error" in json ? json.error : "portal_unreachable";
        portal.setError(
          code === "portal_auth"
            ? t("Portal rejected the login. Check portal URL, email and password.")
            : code === "auth_required"
              ? t("Sign in first (sidebar).")
              : code === "missing_settings"
                ? t("Fill in portal URL, email and password below.")
                : (json && "detail" in json ? json.detail : "") ||
                  "The portal could not be reached.",
        );
        return;
      }
      usePortalStore.getState().setData(json);
      // the plan syncs as structured rows (portal_entries/portal_courses) —
      // no credentials ever leave the device. The fetch is authoritative:
      // retract stale rows from earlier fetches / the phone so the cloud
      // never keeps two versions of the same slot alive.
      void reconcilePortalSnapshot();
      // upcoming Schulaufgaben mirror into the Tasks list (their due date
      // puts them on the calendar automatically)
      syncPortalTestTasks(json.tests ?? []);
    } catch {
      portal.setError(t("The portal could not be reached."));
    } finally {
      setFetching(false);
    }
  };

  // auto-fetch on every visit when enabled and credentials are stored
  useEffect(() => {
    if (!hydrated) return;
    const p = usePortalStore.getState();
    if (p.autoFetch && p.baseUrl && p.username && p.password) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing portal flow
      void fetchNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) return <PageSkeleton />;

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
            {t("Timetable")}
            <Table2 className="size-5 text-accent" />
          </h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-ink-soft">
            {entries.length === 0
              ? t("build your grid cell by cell, or paste it as JSON")
              : editing
                ? t("click a cell to edit it · new cell? just tap the empty slot")
                : t("your weekly grid, overlaid with live substitutions")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={cn("btn-ghost", editing && "border-accent text-accent")}
            onClick={() => {
              setEditing((v) => !v);
              setPanelOpen(false);
            }}
          >
            {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
            {editing ? t("Done") : t("Edit timetable")}
          </button>
          {entries.length > 0 && !editing && (
            <button
              className="btn-ghost"
              onClick={() => {
                setRaw(timetableToJson(entries));
                setPanelOpen(true);
              }}
            >
              <Upload className="size-4" /> {t("Edit JSON")}
            </button>
          )}
          {entries.length > 0 && (
            <button
              className="btn-ghost hover:border-marker/40 hover:text-marker"
              onClick={() => window.confirm(t("Clear the whole timetable?")) && clear()}
            >
              <Eraser className="size-4" /> {t("Clear")}
            </button>
          )}
        </div>
      </header>

      {/* a Feiertag or Ferien today — say so instead of pretending lessons run */}
      {outToday && !editing && (
        <div className="card mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-amber/40 bg-amber/[0.07] px-5 py-3.5">
          <span className="chip border-amber/40 bg-amber/10 font-mono text-amber">
            {outToday.kind === "ferien" ? t("School holidays") : t("Public holiday")}
          </span>
          <span className="text-sm">
            <span className="font-medium">{outToday.name}</span>
            {outToday.end && (
              <span className="text-ink-soft">
                {" "}
                · {t("until")}{" "}
                {new Date(`${outToday.end}T12:00:00`).toLocaleDateString(
                  currentLang() === "de" ? "de-DE" : "en-GB",
                  { day: "numeric", month: "numeric" },
                )}
              </span>
            )}
          </span>
          <span className="ml-auto font-mono text-[10px] tracking-wide text-ink-soft uppercase">
            {t("no lessons today")}
          </span>
        </div>
      )}

      {/* substitute plan portal — collapsed to a status row once connected */}
      <details
        className="card mb-8 px-5 py-4"
        open={!portal.username || !portal.password || !!portal.error}
      >
        <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-display text-base font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
          <span>
            {t("Substitute plan (Vertretungsplan)")}
            {portal.lastFetched && !portal.error && (
              <span className="ml-2 font-mono text-[10px] font-normal text-ink-soft">
                {t("fetched")} {new Date(portal.lastFetched).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </span>
          {!portal.error && portal.username && portal.password && (
            <span className="font-mono text-[10px] font-normal tracking-wide text-ink-soft uppercase">
              {t("connected")} · {relevantSubs.length} {relevantSubs.length === 1 ? t("substitution") : t("substitutions")}
              {(portal.data?.tests?.length ?? 0) > 0 &&
                ` · ${portal.data?.tests.length} ${(portal.data?.tests.length ?? 0) === 1 ? t("upcoming test") : t("upcoming tests")}`}
            </span>
          )}
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="portal-url">
              {t("Portal URL")}
            </label>
            <input
              id="portal-url"
              className="field"
              placeholder="https://evbg.eltern-portal.org"
              value={portal.baseUrl}
              onChange={(e) =>
                usePortalStore.getState().setSettings({ ...portal, baseUrl: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="portal-email">
              {t("Portal email")}
            </label>
            <input
              id="portal-email"
              type="email"
              className="field"
              autoComplete="off"
              value={portal.username}
              onChange={(e) =>
                usePortalStore.getState().setSettings({ ...portal, username: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="portal-password">
              {t("Portal password")}
            </label>
            <input
              id="portal-password"
              type="password"
              className="field"
              autoComplete="off"
              value={portal.password}
              onChange={(e) =>
                usePortalStore.getState().setSettings({ ...portal, password: e.target.value })
              }
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={portal.autoFetch}
              onChange={(e) =>
                usePortalStore.getState().setSettings({ ...portal, autoFetch: e.target.checked })
              }
            />
            fetch automatically on every visit
          </label>
          <button
            className="btn-primary"
            disabled={fetching || !portal.baseUrl || !portal.username || !portal.password}
            onClick={() => void fetchNow()}
          >
            <RefreshCcw className={cn("size-4", fetching && "animate-spin")} />
            {fetching ? t("Fetching…") : t("Fetch now")}
          </button>
        </div>
        {portal.error && <p className="mt-3 text-sm text-marker">{portal.error}</p>}
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-ink-soft">
          credentials are stored only on this device and sent only to your own server when
          fetching.
        </p>
      </details>

      {/* import panel — the advanced path next to the visual editor */}
      {(panelOpen || (entries.length === 0 && !editing)) && (
        <div className="card mb-8 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Paste timetable JSON
            </h2>
            <button
              className="btn-ghost"
              onClick={() => {
                setRaw(EXAMPLE_TIMETABLE);
                setError("");
              }}
            >
              Use example
            </button>
          </div>
          <textarea
            className="field min-h-48 resize-y font-mono text-xs leading-relaxed"
            spellCheck={false}
            placeholder='[{ "day": "mon", "period": 1, "subject": "Mathematics", "room": "B102" }, …]'
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => load(raw)}>
              <Upload className="size-4" /> Format timetable
            </button>
            <p className="font-mono text-[10px] leading-relaxed text-ink-soft">
              each entry: day · period · subject, optional: time · teacher · room. days:
              mon–sun (EN or DE).
            </p>
          </div>
          {error && <p className="mt-3 text-sm text-marker">{error}</p>}
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-0.5 font-mono text-[11px] text-amber">
              {warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* formatted grid */}
      {entries.length > 0 || editing ? (
        <>
          {/* legend */}
          {(relevantSubs.length > 0 || portal.error) && (
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-marker" /> cancelled
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-amber" /> substituted
              </span>
              {relevantSubs.length > 0 && (
                <span>
                  · {relevantSubs.length}
                  {portal.data?.courses.length ? " for your courses" : ""}
                </span>
              )}
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-20 border-b border-r border-line bg-card px-2 py-2.5 font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                    Pd
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={cn(
                        "border-b border-line px-3 py-2.5 font-display text-base font-semibold tracking-tight",
                        d === todayCol && "bg-accent-soft text-accent",
                      )}
                    >
                      {t(d)}
                      {d === todayCol && (
                        <span className="ml-2 font-mono text-[9px] tracking-[0.14em] uppercase">
                          {t("today")}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p} className="align-top">
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-b border-r border-line bg-card px-2 py-2 text-center",
                        lessonNow.current?.entry.period === p && "font-semibold text-accent",
                      )}
                    >
                      <div className="font-mono text-sm font-semibold">{p}</div>
                      {periodTime.get(p) && (
                        <div className="font-mono text-[9px] leading-tight text-ink-soft">
                          {periodTime.get(p)!.split(" - ")[0]}
                        </div>
                      )}
                    </td>
                    {days.map((d) => {
                      const items = entries.filter((e) => e.day === d && e.period === p);
                      const cellSubs = cellSubsFor(d, p);
                      const cancelled = cellSubs.some((s) => s.cancelled);
                      const substituted = cellSubs.some((s) => !s.cancelled);
                      // a Feiertag/Ferien runs the clock but has no lessons
                      const isNow =
                        d === todayCol &&
                        lessonNow.current?.entry.period === p &&
                        !outToday;
                      const openCell = () =>
                        setSlot({ day: d, period: p, entry: items[0], periodTime: periodTime.get(p) });
                      const clickable = editing && cellSubs.length === 0;
                      return (
                        <td
                          key={d}
                          onClick={clickable ? openCell : undefined}
                          onKeyDown={
                            clickable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openCell();
                                  }
                                }
                              : undefined
                          }
                          role={clickable ? "button" : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          aria-label={clickable ? `${t(d)} · ${p}. ${t("Period")}` : undefined}
                          className={cn(
                            "border-b border-line px-2 py-2 align-top transition-colors",
                            d === todayCol && !isNow && "bg-accent/[0.06]",
                            isNow && "bg-accent/[0.1] ring-1 ring-inset ring-accent/40",
                            cancelled && items.length > 0 && "bg-marker/[0.08]",
                            substituted && !cancelled && items.length > 0 && "bg-amber/[0.07]",
                            clickable && "cursor-pointer hover:bg-accent/[0.08] focus-visible:bg-accent/[0.08] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                          )}
                        >
                          {items.length === 0 && cellSubs.length === 0 ? (
                            <span
                              className={cn(
                                "grid place-items-center",
                                editing
                                  ? "min-h-9 rounded-md border border-dashed border-line text-ink-soft/50"
                                  : "text-ink-soft/40",
                              )}
                              aria-hidden
                            >
                              {editing ? <Plus className="size-4" /> : "—"}
                            </span>
                          ) : (
                            <div className="space-y-1.5">
                              {items.map((e, i) => (
                                <div key={i}>
                                  <div className="flex items-center gap-1.5">
                                    <SubjectDot color={subjectColor(e.subject, subjectColors)} />
                                    <span
                                      className={cn(
                                        "text-xs leading-tight font-semibold",
                                        cancelled && "line-through decoration-marker",
                                      )}
                                    >
                                      {e.subject}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 font-mono text-[9px] leading-tight text-ink-soft">
                                    {e.time && <div>{e.time}</div>}
                                    {e.teacher && <div>{e.teacher}</div>}
                                    {e.room && <div>room {e.room}</div>}
                                  </div>
                                </div>
                              ))}
                              {cellSubs.map((s, i) => (
                                <span
                                  key={`s${i}`}
                                  className={cn(
                                    "chip max-w-full",
                                    s.cancelled
                                      ? "border-marker/40 bg-marker/10 text-marker"
                                      : "border-amber/40 bg-amber/10 text-amber",
                                  )}
                                  title={`${s.date} · ${s.info || (s.cancelled ? "cancelled" : "substitution")}`}
                                >
                                  {s.cancelled
                                    ? "cancelled"
                                    : `→ ${s.substitute || "?"}${s.room ? ` · ${s.room}` : ""}`}
                                  {" · "}
                                  {s.date.slice(0, 6)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {editing && (
                  <tr>
                    <td className="sticky left-0 z-10 border-b border-r border-line bg-card px-2 py-2" />
                    <td colSpan={days.length} className="border-b border-line px-3 py-2.5">
                      <button
                        className="btn-ghost px-3 py-1.5 text-xs"
                        onClick={() =>
                          setSlot({ day: days[0], period: (periods[periods.length - 1] ?? 0) + 1 })
                        }
                      >
                        <Plus className="size-3.5" /> {t("Add period")}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
                </table>
              </div>
              {editing && !days.includes("Sat") && (
                <button
                  className="btn-ghost mt-3 px-3 py-1.5 text-xs"
                  onClick={() => setSlot({ day: "Sat", period: periods[0] ?? 1 })}
                >
                  <Plus className="size-3.5" /> {t("Add Saturday")}
                </button>
              )}
              {editing && (
                <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-ink-soft">
                  <Pencil className="size-3" />
                  {t("Tap a cell to place a subject · the time applies to the whole period row")}
                </p>
              )}
            </>
          ) : (
            !panelOpen &&
            !editing && (
              <EmptyState
                icon={<Table2 className="size-8" />}
                title="No timetable yet"
                hint="Build your grid cell by cell — tap a slot and type the subject. Or paste your school's timetable as JSON; the example shows the exact format."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <button className="btn-primary" onClick={() => setEditing(true)}>
                      <Pencil className="size-4" /> {t("Build in the editor")}
                    </button>
                    <button className="btn-ghost" onClick={() => setPanelOpen(true)}>
                      <Upload className="size-4" /> {t("Paste JSON")}
                    </button>
                  </div>
                }
              />
            )
          )}

          {/* the editor modal, mounted per slot so its fields initialize fresh */}
          {slot && (
            <LessonEditor
              key={`${slot.day}-${slot.period}-${slot.entry ? "e" : "n"}`}
              slot={slot}
              onClose={() => setSlot(null)}
            />
          )}

      {/* substitutions list — all the info */}
      {relevantSubs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">{t("Substitutions")}</h2>
          <div className="space-y-4">
            {portal.data?.days.map((day) => {
              const daySubs = relevantSubs.filter((s) => s.date === day.date);
              if (daySubs.length === 0) return null;
              return (
                <div key={day.date} className="card px-5 py-4">
                  <p className="font-mono text-[11px] text-ink-soft">
                    {day.weekday}., {day.date}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {daySubs.map((s) => (
                      <li
                        key={s.period + s.course + (s.substitute ?? "")}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <span
                          className={cn(
                            "chip font-mono",
                            s.cancelled
                              ? "border-marker/40 bg-marker/10 text-marker"
                              : "border-amber/40 bg-amber/10 text-amber",
                          )}
                        >
                          {s.period}.
                        </span>
                        <span className="font-medium">
                          {s.courseOld && (
                            <span className="mr-1 text-ink-soft line-through">{s.courseOld}</span>
                          )}
                          {s.course}
                        </span>
                        {!s.cancelled && s.substitute && (
                          <span className="text-ink-soft">→ {s.substitute}</span>
                        )}
                        {s.room && (
                          <span className="font-mono text-xs text-ink-soft">room {s.room}</span>
                        )}
                        {s.info && <span className="text-xs text-ink-soft">{s.info}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* upcoming tests — Schulaufgaben from the portal's termine feed,
          mirrored into the calendar as exam events */}
      {(portal.data?.tests?.length ?? 0) > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 font-display text-xl font-semibold tracking-tight">{t("Upcoming tests")}</h2>
          <p className="mb-3 font-mono text-[10px] tracking-wide text-ink-soft">
            {t("schulaufgaben from the Eltern-Portal, added to your tasks automatically")}
          </p>
          <div className="space-y-1.5">
            {(portal.data?.tests ?? []).map((t) => {
              const wd = DAY_ORDER[(new Date(`${t.date}T00:00:00`).getDay() + 6) % 7];
              return (
                <div
                  key={t.sourceId + t.date}
                  className="card flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="chip border-accent/40 bg-accent/10 font-mono text-accent">
                    {wd} {t.date.slice(8, 10)}.{t.date.slice(5, 7)}.
                  </span>
                  <span className="font-medium">{t.title}</span>
                  {t.time && <span className="font-mono text-xs text-ink-soft">{t.time}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

