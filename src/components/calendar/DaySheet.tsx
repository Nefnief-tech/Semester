"use client";

import { useState } from "react";
import { isToday, parseISO } from "date-fns";
import { CalendarPlus, Check, Pencil } from "lucide-react";
import type { StudyEvent } from "@/lib/types";
import { useTodosStore } from "@/lib/store/todos";
import { cn, dayKeyLabel, findSubject } from "@/lib/utils";
import { useDateLocale, useT } from "@/lib/i18n";
import Modal from "@/components/ui/Modal";
import { Chip, itemsForDay } from "@/components/calendar/items";
import EventFormModal from "@/components/calendar/EventFormModal";
import { useEventsStore } from "@/lib/store/events";
import { useSubjectsStore } from "@/lib/store/subjects";

/**
 * Day agenda sheet: everything on one date — events (editable), todos
 * (tickable) — with quick add. Opened from calendar day cells; editing an
 * entry opens the entry form on top and returns here.
 */
export default function DaySheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  const t = useT();
  const dateLocale = useDateLocale();
  const events = useEventsStore((s) => s.events);
  const todos = useTodosStore((s) => s.todos);
  const toggleTodo = useTodosStore((s) => s.toggleTodo);
  const subjects = useSubjectsStore((s) => s.subjects);

  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<StudyEvent | null>(null);

  const items = date ? itemsForDay(events, todos, date) : [];
  const d = date ? parseISO(date) : null;

  return (
    <>
      <Modal open={date !== null} onClose={onClose} title={date ? dayKeyLabel(date) : ""}>
        {date && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
              {d && isToday(d) && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-paper">{t("today")}</span>
              )}
              {items.length === 0
                ? t("nothing planned")
                : `${items.length} ${items.length === 1 ? t("entry") : t("entries")}`}
            </p>

            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm italic text-ink-soft">
                {t("A free day. Add an entry below or enjoy it.")}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) =>
                  item.kind === "event" ? (
                    <li key={item.event.id}>
                      <Chip
                        item={item}
                        onClick={() => {
                          setEditEvent(item.event);
                          setFormOpen(true);
                        }}
                        className="py-2 text-sm"
                      />
                    </li>
                  ) : (
                    <li
                      key={item.todo.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5",
                        item.todo.done && "opacity-70",
                      )}
                    >
                      <button
                        onClick={() => toggleTodo(item.todo.id)}
                        aria-label={item.todo.done ? "Mark as open" : "Mark as done"}
                        className={cn(
                          "grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors",
                          item.todo.done
                            ? "border-accent bg-accent text-paper"
                            : "border-ink/30 hover:border-accent hover:bg-accent/10",
                        )}
                      >
                        {item.todo.done && <Check className="size-3" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            item.todo.done && "text-ink-soft line-through",
                          )}
                        >
                          {item.todo.title}
                        </p>
                        <p className="font-mono text-[10px] text-ink-soft">
                          {t("task")}
                          {(() => {
                            const subject = findSubject(subjects, item.todo.subjectId);
                            return subject ? ` · ${subject.name}` : "";
                          })()}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}

            <button
              className="btn-primary w-full"
              onClick={() => {
                setEditEvent(null);
                setFormOpen(true);
              }}
            >
              <CalendarPlus className="size-4" /> {t("New entry")}
            </button>
            <p className="flex items-center gap-1.5 font-mono text-[10px] text-ink-soft">
              <Pencil className="size-3" /> {t("click an entry to edit · tasks can be ticked here")}
            </p>
          </div>
        )}
      </Modal>

      <EventFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        date={date ?? undefined}
        event={editEvent ?? undefined}
      />
    </>
  );
}
