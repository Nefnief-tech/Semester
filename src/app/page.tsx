"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, format, isToday, parseISO, startOfDay } from "date-fns";
import { BookOpen, Check, GraduationCap, MapPin, Plus, Trash2 } from "lucide-react";
import { useTodosStore } from "@/lib/store/todos";
import { useEventsStore } from "@/lib/store/events";
import { useSubjectsStore } from "@/lib/store/subjects";
import { useGradesStore } from "@/lib/store/grades";
import { useHomeworkStore } from "@/lib/store/homework";
import { useTimetableStore } from "@/lib/store/timetable";
import { useHydrated } from "@/lib/hooks";
import { minutesToClock, timetableNow } from "@/lib/schedule";
import { useDateLocale, useT } from "@/lib/i18n";
import type { Homework, StudyEvent, Todo } from "@/lib/types";
import {
  cn,
  dayKeyLabel,
  dueInfo,
  findSubject,
  formatPoints,
  pointsTone,
  toDayKey,
  weightedAverage,
} from "@/lib/utils";
import PageSkeleton from "@/components/ui/PageSkeleton";
import OnboardingCard from "@/components/dashboard/OnboardingCard";
import { DueChip, SubjectDot } from "@/components/ui/bits";
import { Chip } from "@/components/calendar/items";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
/* translated at the call site via t() — the keys are the greeting strings */

type QueueItem =
  | { kind: "todo"; sort: number; todo: Todo; overdue?: boolean }
  | { kind: "homework"; sort: number; homework: Homework; overdue?: boolean };

export default function DashboardPage() {
  const hydrated = useHydrated();
  const todos = useTodosStore((s) => s.todos);
  const addTodo = useTodosStore((s) => s.addTodo);
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const events = useEventsStore((s) => s.events);
  const subjects = useSubjectsStore((s) => s.subjects);
  const entries = useGradesStore((s) => s.entries);
  const timetableEntries = useTimetableStore((s) => s.entries);

  const t = useT();
  const dateLocale = useDateLocale();
  const homeworks = useHomeworkStore((s) => s.homeworks);
  const toggleHomework = useHomeworkStore((s) => s.toggleHomework);
  const openHomework = useMemo(() => homeworks.filter((h) => !h.done), [homeworks]);

  const openTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);

  const [quickTitle, setQuickTitle] = useState("");
  // the Now/Next card re-reads the clock every 30 s so "ends in" stays honest
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const lessonNow = useMemo(
    () => timetableNow(timetableEntries, clock),
    [timetableEntries, clock],
  );

  const stats = useMemo(() => {
    return {
      open: openTodos.length,
      dueToday: openTodos.filter((t) => dueInfo(t.due)?.isToday).length,
      homeworkOpen: openHomework.length,
      overall: weightedAverage(entries),
    };
  }, [openTodos, openHomework, entries]);

  // dated first, undated keep their creation order — homework must never be
  // crowded out of the dashboard by undated tasks, so the lists stay separate
  const sortedTodos = useMemo(() => {
    return [...openTodos].sort((a, b) => {
      const da = dueInfo(a.due)?.date?.getTime() ?? Infinity;
      const db = dueInfo(b.due)?.date?.getTime() ?? Infinity;
      if (da !== db) return da - db;
      return a.createdAt - b.createdAt;
    });
  }, [openTodos]);

  const sortedHomework = useMemo(() => {
    return [...openHomework].sort((a, b) => {
      const da = dueInfo(a.due)?.date?.getTime() ?? Infinity;
      const db = dueInfo(b.due)?.date?.getTime() ?? Infinity;
      if (da !== db) return da - db;
      return b.createdAt - a.createdAt;
    });
  }, [openHomework]);

  const asTodoItem = (t: Todo): QueueItem => ({
    kind: "todo",
    sort: dueInfo(t.due)?.date?.getTime() ?? Infinity,
    todo: t,
  });

  const weekSchedule = useMemo(() => {
    const buckets = new Map<
      string,
      Array<{ id: string; kind: "event" | "todo" | "homework"; item: unknown }>
    >();
    const start = toDayKey(new Date());
    const end = toDayKey(addDays(new Date(), 6));
    const push = (
      key: string,
      entry: { id: string; kind: "event" | "todo" | "homework"; item: unknown },
    ) => {
      if (key < start || key > end) return;
      const list = buckets.get(key) ?? [];
      list.push(entry);
      buckets.set(key, list);
    };
    for (const e of events) push(e.date, { id: e.id, kind: "event", item: e });
    for (const t of openTodos) {
      if (!t.due) continue;
      push(t.due.slice(0, 10), { id: t.id, kind: "todo", item: t });
    }
    for (const h of openHomework) {
      if (!h.due) continue;
      push(h.due.slice(0, 10), { id: h.id, kind: "homework", item: h });
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, items }));
  }, [events, openTodos, openHomework]);

  const weekStrip = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(new Date(), i);
        const key = toDayKey(day);
        return {
          key,
          day,
          count: weekSchedule.find((s) => s.key === key)?.items.length ?? 0,
        };
      }),
    [weekSchedule],
  );

  const subjectRows = useMemo(
    () =>
      subjects.map((s) => ({
        subject: s,
        avg: weightedAverage(entries.filter((e) => e.subjectId === s.id)),
      })),
    [subjects, entries],
  );

  // upcoming exams, soonest first — the countdown strip under the hero
  const examCountdowns = useMemo(() => {
    const todayStart = new Date(clock);
    todayStart.setHours(0, 0, 0, 0);
    return events
      .filter((e) => e.type === "exam")
      .map((e) => {
        const d = parseISO(e.date);
        return {
          event: e,
          days: Math.round((startOfDay(d).getTime() - todayStart.getTime()) / 86_400_000),
        };
      })
      .filter(({ days }) => days >= 0 && days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [events, clock]);

  // one pile for everything due today (tasks and homework alike), then the
  // rest of the task queue; homework additionally gets its own card below
  const { todayFocus, restTodos, homeworkQueue } = useMemo(() => {
    const nowMs = clock.getTime();
    const end = new Date(nowMs);
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();

    const homeworkDueToday: QueueItem[] = sortedHomework
      .filter((h) => {
        const info = dueInfo(h.due);
        return !!info && info.date.getTime() <= endMs;
      })
      .map((h) => ({
        kind: "homework" as const,
        sort: dueInfo(h.due)?.date?.getTime() ?? endMs,
        homework: h,
        overdue: (dueInfo(h.due)?.date.getTime() ?? endMs) < nowMs,
      }));

    const todosDueToday: QueueItem[] = sortedTodos
      .filter((t) => {
        const info = dueInfo(t.due);
        return !!info && info.date.getTime() <= endMs;
      })
      .map((t) => ({
        kind: "todo" as const,
        sort: dueInfo(t.due)?.date.getTime() ?? endMs,
        todo: t,
        overdue: (dueInfo(t.due)?.date.getTime() ?? endMs) < nowMs,
      }));

    const focus = [...todosDueToday, ...homeworkDueToday].sort((a, b) => a.sort - b.sort);
    const focusTodoIds = new Set(
      focus.filter((f) => f.kind === "todo").map((f) => (f as { todo: Todo }).todo.id),
    );

    return {
      todayFocus: focus,
      restTodos: sortedTodos
        .filter((t) => !focusTodoIds.has(t.id))
        .slice(0, 6)
        .map(asTodoItem),
      homeworkQueue: sortedHomework
        .slice(0, 5)
        .map((h) => ({
          kind: "homework" as const,
          sort: dueInfo(h.due)?.date?.getTime() ?? Infinity,
          homework: h,
        })),
    };
  }, [sortedTodos, sortedHomework, clock]);

  const isEmpty = todos.length === 0 && events.length === 0 && subjects.length === 0;

  const addQuickTask = () => {
    const title = quickTitle.trim();
    if (!title) return;
    addTodo({ title, priority: "medium", due: toDayKey(new Date()) });
    setQuickTitle("");
  };

  if (!hydrated) return <PageSkeleton />;

  const queueRow = (item: QueueItem) => {
    const isHw = item.kind === "homework";
    const title = isHw ? item.homework.title : item.todo.title;
    const due = isHw ? item.homework.due : item.todo.due;
    const subject = findSubject(subjects, isHw ? item.homework.subjectId : item.todo.subjectId);
    return (
      <li
        key={`${item.kind}-${isHw ? item.homework.id : item.todo.id}`}
        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-paper-deep/50"
      >
        <button
          aria-label="mark as done"
          className={cn(
            "mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors",
            item.overdue
              ? "border-marker/60 hover:bg-marker/10"
              : "border-ink/30 hover:border-accent hover:bg-accent/10",
          )}
          onClick={() => (isHw ? toggleHomework(item.homework.id) : toggleTodo(item.todo.id))}
        >
          <Check className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {isHw && <BookOpen className="size-3.5 shrink-0 text-accent" />}
            <span className={cn("truncate", item.overdue && "text-marker")}>{title}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {subject && (
              <span className="chip">
                <SubjectDot color={subject.color} />
                {subject.name}
              </span>
            )}
            <DueChip due={due} />
          </div>
        </div>
      </li>
    );
  };

  const microHeader = (label: string, count?: number, href?: string) => (
    <div className="mb-2 flex items-baseline justify-between">
      <p className="font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase">
        {label}
        {count !== undefined && <span className="ml-1.5 text-ink">{count}</span>}
      </p>
      {href && (
        <Link href={href} className="section-link">
          all →
        </Link>
      )}
    </div>
  );

  return (
    <div>
      {isEmpty && <OnboardingCard />}

      {/* ============ level 1 · hero: greeting beside the lesson that is on ============ */}
      <header
        className={cn(
          "rise mb-10 grid items-center gap-8",
          lessonNow.status !== "none" && "lg:grid-cols-[1.2fr_1fr]",
        )}
      >
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-ink-soft uppercase">
            {format(clock, "EEEE, d MMMM yyyy", { locale: dateLocale })}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
            {t(greeting())}.
            <span className="text-accent italic">
              {stats.dueToday > 0
                ? ` ${stats.dueToday} ${stats.dueToday === 1 ? t("task due today.") : t("tasks due today.")}`
                : ` ${t("Nothing due today.")}`}
            </span>
          </h1>
          <p className="mt-3 flex gap-5 font-mono text-[11px] text-ink-soft">
            <Link href="/todos" className="transition-colors hover:text-ink">
              {stats.open} {t("open tasks")}
            </Link>
            <Link href="/homework" className="transition-colors hover:text-ink">
              {stats.homeworkOpen} {t("homework")}
            </Link>
            {stats.overall !== null && (
              <Link href="/grades" className="transition-colors hover:text-ink">
                Ø {formatPoints(stats.overall)} Pkt.
              </Link>
            )}
          </p>
        </div>

        {lessonNow.status !== "none" && (
          <div className="card relative overflow-hidden px-6 py-5">
            <span className="absolute inset-y-0 left-0 w-1.5 bg-accent" aria-hidden />
            {lessonNow.current ? (
              <div className="pl-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
                    {t("Now · until")} {minutesToClock(lessonNow.current.end)}
                  </p>
                  <p className="font-mono text-[10px] text-ink-soft">
                    {lessonNow.current.endsIn} {t("min left")}
                  </p>
                </div>
                <p className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
                  {lessonNow.current.entry.subject}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-soft">
                  {lessonNow.current.entry.room && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {lessonNow.current.entry.room}
                    </span>
                  )}
                  {lessonNow.current.entry.teacher && (
                    <span>{lessonNow.current.entry.teacher}</span>
                  )}
                  {lessonNow.current.entry.time && <span>{lessonNow.current.entry.time}</span>}
                </p>
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-paper-deep">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${Math.round(
                        ((lessonNow.current.end - lessonNow.current.endsIn) /
                          (lessonNow.current.end - lessonNow.current.start)) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : lessonNow.next ? (
              <div className="pl-3">
                <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                  {lessonNow.next.startsIn <= 60
                    ? `Next in ${lessonNow.next.startsIn} min`
                    : `Next at ${minutesToClock(lessonNow.next.start)}`}
                </p>
                <p className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
                  {lessonNow.next.entry.subject}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-soft">
                  {lessonNow.next.entry.room && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {lessonNow.next.entry.room}
                    </span>
                  )}
                  {lessonNow.next.entry.teacher && (
                    <span>{lessonNow.next.entry.teacher}</span>
                  )}
                  {lessonNow.next.entry.time && <span>{lessonNow.next.entry.time}</span>}
                </p>
              </div>
            ) : (
              <p className="pl-3 text-sm italic text-ink-soft">{t("Lessons are over for today.")}</p>
            )}
          </div>
        )}
      </header>

      {/* exam countdown strip — the tests you should be thinking about */}
      {examCountdowns.length > 0 && (
        <section className="rise mb-10" style={{ "--d": ".03s" } as React.CSSProperties}>
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="mr-1 size-4 text-accent" />
            {examCountdowns.map(({ event, days }) => (
              <Link
                key={event.id}
                href="/calendar"
                className="chip border-accent/40 bg-accent/[0.08] px-3 py-1.5 text-xs transition-colors hover:border-accent/70"
                title={event.notes ?? "Exam"}
              >
                <span className="font-semibold">{event.title}</span>
                <span className="font-mono text-[10px] text-ink-soft">
                  {days === 0
                    ? t("today")
                    : days === 1
                      ? t("tomorrow")
                      : t("in X days").replace("{n}", String(days))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============ level 2 · the protagonist: today ============ */}
      <section className="rise mb-12" style={{ "--d": ".06s" } as React.CSSProperties}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {t("Today")}
            <span className="ml-2 font-mono text-sm font-normal text-ink-soft">
              {todayFocus.length > 0 ? todayFocus.length : ""}
            </span>
          </h2>
          <Link href="/todos" className="section-link">
            {t("all tasks →")}
          </Link>
        </div>

        <div className="card overflow-hidden">
          {/* quick add — a first-class field, not a whisper */}
          <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <span
              className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
              aria-hidden
            >
              <Plus className="size-3.5" />
            </span>
            <input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuickTask()}
              placeholder={t("Add a task for today and press Enter")}
              aria-label="Quick-add a task due today"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft/60"
            />
          </div>

          {todayFocus.length === 0 ? (
            <p className="px-5 py-6 text-sm italic text-ink-soft">
              {t("Nothing due today. The desk is calm.")}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {todayFocus.map(queueRow)}
            </ul>
          )}
        </div>
      </section>

      {/* ============ level 3 · context, quietly — flows into as many columns
          as the content fills; empty sections drop out entirely ============ */}
      {(restTodos.length > 0 ||
        openHomework.length > 0 ||
        weekSchedule.length > 0 ||
        subjectRows.length > 0) && (
        <div
          className="rise columns-1 gap-8 lg:columns-2 xl:columns-3"
          style={{ "--d": ".12s" } as React.CSSProperties}
        >
          {/* up next — tasks with and without a date */}
          {restTodos.length > 0 && (
            <section className="mb-8 break-inside-avoid">
              {microHeader(t("up next"), restTodos.length, "/todos")}
              <ul className="card divide-y divide-line px-2">
                {restTodos.map(queueRow)}
              </ul>
            </section>
          )}

          {/* homework — every open assignment, dated or not */}
          {openHomework.length > 0 && (
            <section className="mb-8 break-inside-avoid">
              {microHeader(t("Homework"), openHomework.length, "/homework")}
              <ul className="card divide-y divide-line px-2">
                {homeworkQueue.map(queueRow)}
              </ul>
            </section>
          )}

          {/* this week */}
          {weekSchedule.length > 0 && (
            <section className="mb-8 break-inside-avoid">
              {microHeader(t("This week"), weekSchedule.length, "/calendar")}
              <div className="card p-3">
                <div className="grid grid-cols-7 gap-1">
                  {weekStrip.map(({ key, day, count }) => (
                    <Link
                      key={key}
                      href="/calendar"
                      className={cn(
                        "rounded-lg px-1 py-2 text-center transition-colors",
                        isToday(day) ? "bg-accent text-paper" : "hover:bg-paper-deep",
                      )}
                      aria-label={dayKeyLabel(key)}
                    >
                      <span
                        className={cn(
                          "block font-mono text-[9px] uppercase",
                          isToday(day) ? "text-paper/80" : "text-ink-soft",
                        )}
                      >
                        {format(day, "EEE")}
                      </span>
                      <span className="block font-display text-base font-semibold">
                        {format(day, "d")}
                      </span>
                      <span
                        className={cn(
                          "mx-auto mt-0.5 block h-1 w-1 rounded-full",
                          count > 0 ? (isToday(day) ? "bg-paper" : "bg-accent") : "bg-transparent",
                        )}
                      />
                    </Link>
                  ))}
                </div>

                <ul className="mt-3 max-h-64 space-y-2.5 overflow-y-auto border-t border-line pt-2.5">
                  {weekSchedule.map(({ key, items }) => (
                    <li key={key}>
                      <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                        {dayKeyLabel(key)}
                      </p>
                      <div className="space-y-1.5">
                        {items.map(({ id, kind, item }) =>
                          kind === "homework" ? (
                            <div
                              key={id}
                              className="flex items-center gap-1.5 rounded-md border border-line bg-card px-1.5 py-1.5 text-xs"
                            >
                              <BookOpen className="size-3 shrink-0 text-ink-soft" />
                              <span className="truncate">{(item as Homework).title}</span>
                            </div>
                          ) : (
                            <Chip
                              key={id}
                              item={
                                kind === "event"
                                  ? {
                                      kind: "event",
                                      event: item as StudyEvent,
                                      time: (item as { time?: string }).time,
                                    }
                                  : { kind: "todo", todo: item as Todo, time: undefined }
                              }
                              onClick={() => {
                                if (kind === "todo") toggleTodo(id);
                              }}
                              className="py-1.5 text-xs"
                            />
                          ),
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* subjects */}
          {subjectRows.length > 0 && (
            <section className="mb-8 break-inside-avoid">
              {microHeader(t("Subjects"), subjectRows.length, "/grades")}
              <ul className="card divide-y divide-line px-4">
                {subjectRows.map(({ subject, avg }) => {
                  const tone = avg === null ? ("neutral" as const) : pointsTone(avg);
                  return (
                    <li key={subject.id} className="flex items-center gap-3 py-3">
                      <SubjectDot color={subject.color} />
                      <span className="w-20 truncate text-sm font-medium md:w-24">
                        {subject.name}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            tone === "good" && "bg-accent",
                            tone === "ok" && "bg-info",
                            tone === "warn" && "bg-amber",
                            tone === "bad" && "bg-marker",
                            avg === null && "bg-line",
                          )}
                          style={{ width: `${avg === null ? 0 : Math.min(100, avg)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-xs font-semibold">
                        {avg === null ? "-" : formatPoints(avg)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* danger zone */}
      <footer className="mt-14 flex justify-end border-t border-line pt-4">
        <button
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[10px] tracking-wide text-ink-soft/70 uppercase transition-colors hover:text-marker"
          onClick={() => {
            if (!window.confirm(t("Delete all tasks, grades, events and subjects? This cannot be undone.")))
              return;
            useTodosStore.getState().clearAll();
            useGradesStore.getState().clearAll();
            useEventsStore.getState().clearAll();
            useSubjectsStore.getState().clearAll();
            useHomeworkStore.getState().clearAll();
          }}
        >
          <Trash2 className="size-3" /> {t("clear all data")}
        </button>
      </footer>
    </div>
  );
}
