"use client";

import { useMemo, useState } from "react";
import { addDays, addMonths, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { BookOpen, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { StudyEvent } from "@/lib/types";
import { useTodosStore } from "@/lib/store/todos";
import { cn, toDayKey } from "@/lib/utils";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useHydrated } from "@/lib/hooks";
import { useDateLocale, useT } from "@/lib/i18n";
import EventFormModal from "@/components/calendar/EventFormModal";
import DaySheet from "@/components/calendar/DaySheet";
import { Chip, TYPE_DOT, TYPE_LABELS, useCalendarRange } from "@/components/calendar/items";

type View = "month" | "week";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // translated at render
const WEEKDAYS_DE: Record<string, string> = { Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So" };

export default function CalendarPage() {
  const hydrated = useHydrated();
  const t = useT();
  const dateLocale = useDateLocale();
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [modal, setModal] = useState<{ open: boolean; date?: string; event?: StudyEvent }>({
    open: false,
  });
  const [daySheet, setDaySheet] = useState<string | null>(null);

  const { itemsFor } = useCalendarRange(cursor, cursor);
  const weekday = (en: string) => (dateLocale ? WEEKDAYS_DE[en] ?? en : en);

  // month grid: 6 weeks starting Monday, covering the whole displayed month
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  // week view: Monday..Sunday of the cursor's week
  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const move = (dir: -1 | 1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addDays(c, dir * 7)));

  const rangeLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy", { locale: dateLocale })
      : `${format(weekDays[0], "d MMM", { locale: dateLocale })} – ${format(weekDays[6], "d MMM yyyy", { locale: dateLocale })}`;

  if (!hydrated) return <PageSkeleton />;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight capitalize">
            {rangeLabel}
          </h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-ink-soft">
            {t("deadlines, sessions & task due dates")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-line bg-card">
            <button className="btn-icon rounded-r-none" onClick={() => move(-1)} aria-label={t("Previous")}>
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="cursor-pointer border-x border-line px-3 py-1.5 font-mono text-[11px] tracking-wide uppercase hover:bg-ink/5"
              onClick={() => setCursor(new Date())}
            >
              {t("Today")}
            </button>
            <button className="btn-icon rounded-l-none" onClick={() => move(1)} aria-label="Next">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex rounded-lg border border-line bg-card p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-colors",
                  view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
                )}
              >
                {t(v)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => setModal({ open: true })}>
            <Plus className="size-4" /> {t("New entry")}
          </button>
        </div>
      </header>

      {/* legend */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] tracking-wide text-ink-soft uppercase">
        {(Object.keys(TYPE_DOT) as Array<keyof typeof TYPE_DOT>).map((typ) => (
          <span key={typ} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", TYPE_DOT[typ])} /> {t(TYPE_LABELS[typ])}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink/40" /> {t("due tasks")}
        </span>
      </div>

      {view === "month" ? (
        <div>
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase"
              >
                <span className="max-sm:hidden">{weekday(d)}</span>
                <span className="sm:hidden">{weekday(d)[0]}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const key = toDayKey(day);
              const items = itemsFor(day);
              const shown = items.slice(0, 2);
              const hidden = items.length - shown.length;
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDaySheet(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDaySheet(key);
                    }
                  }}
                  className={cn(
                    "min-h-20 cursor-pointer border-b border-r border-line/70 p-1.5 transition-colors hover:bg-accent/[0.04] focus-visible:bg-accent/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:min-h-28 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-paper-deep/50 text-ink-soft",
                    isToday(day) && "bg-accent/[0.05]",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-0.5">
                    <span
                      className={cn(
                        "font-mono text-[11px]",
                        isToday(day) &&
                          "grid size-5 place-items-center rounded-full bg-accent font-semibold text-paper",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {items.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDaySheet(key);
                        }}
                        className="cursor-pointer font-mono text-[9px] text-ink-soft transition-colors hover:text-accent"
                        aria-label={`${items.length} entries on ${key}`}
                      >
                        {items.length}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {/* sm+: readable chips, max two */}
                    <div className="hidden space-y-1 sm:block">
                      {shown.map((item) => (
                        <Chip
                          key={item.kind === "event" ? item.event.id : item.todo.id}
                          item={item}
                          className="max-w-full"
                          onClick={() => {
                            if (item.kind === "event") setModal({ open: true, event: item.event });
                            else toggleTodo(item.todo.id);
                          }}
                        />
                      ))}
                    </div>
                    {/* mobile: type dots — the day sheet holds the detail */}
                    <div className="flex flex-wrap gap-1 sm:hidden">
                      {items.slice(0, 4).map((item) => (
                        <span
                          key={`dot-${item.kind === "event" ? item.event.id : item.todo.id}`}
                          className={cn(
                            "size-1.5 rounded-full",
                            item.kind === "event"
                              ? TYPE_DOT[item.event.type]
                              : "bg-ink/40",
                          )}
                        />
                      ))}
                    </div>
                    {hidden > 0 && (
                      <span className="block px-1 font-mono text-[10px] text-ink-soft">
                        +{hidden}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-7">
          {weekDays.map((day) => {
            const key = toDayKey(day);
            const items = itemsFor(day);
            return (
              <div
                key={day.toISOString()}
                role="button"
                tabIndex={0}
                onClick={() => setDaySheet(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDaySheet(key);
                  }
                }}
                className={cn(
                  "flex min-h-40 cursor-pointer flex-col rounded-xl border bg-card transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                  isToday(day) ? "border-accent/50 bg-accent/[0.03]" : "border-line",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between rounded-t-xl border-b px-3 py-2",
                    isToday(day) ? "border-accent/30 bg-accent-soft" : "border-line",
                  )}
                >
                  <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                    {format(day, "EEE", { locale: dateLocale })}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-xs",
                      isToday(day) && "grid size-5 place-items-center rounded-full bg-accent font-semibold text-paper",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5 p-2">
                  {items.map((item) => (
                    <Chip
                      key={item.kind === "event" ? item.event.id : item.todo.id}
                      item={item}
                      onClick={() => {
                        if (item.kind === "event") setModal({ open: true, event: item.event });
                        else toggleTodo(item.todo.id);
                      }}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="px-1 pt-2 text-center font-mono text-[10px] text-ink-soft/70">
                      {t("free")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center gap-1.5 text-xs text-ink-soft">
        <BookOpen className="size-3.5" />
        {t("Click a day for its agenda · click an entry to edit or tick it off")}
      </div>

      <EventFormModal
        open={modal.open}
        date={modal.date}
        event={modal.event}
        onClose={() => setModal({ open: false })}
      />

      <DaySheet date={daySheet} onClose={() => setDaySheet(null)} />
    </div>
  );
}
