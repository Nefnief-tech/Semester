"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { TimetableEntry } from "@/lib/types";
import { timetableRowId, useTimetableStore } from "@/lib/store/timetable";
import { useT } from "@/lib/i18n";
import Modal from "@/components/ui/Modal";

export interface LessonSlot {
  day: string;
  period: number;
  entry?: TimetableEntry;
  /** the time already used elsewhere in this period row, as a suggestion */
  periodTime?: string;
}

const splitTime = (time?: string) => {
  const m = (time ?? "").match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  return { start: m?.[1] ?? "", end: m?.[2] ?? "" };
};

/**
 * One timetable cell (day × period): subject, teacher, room and the period
 * time. The time can be applied to the whole period row — the school bell
 * rings for everyone. Rows are content-addressed (timetableRowId), so a
 * changed time removes the old row and writes the new one; the row sync
 * picks both up from the store subscription.
 *
 * The parent mounts this per slot (with a `key`), so the local field state
 * initializes from props — no reset-on-open effect.
 */
export default function LessonEditor({ slot, onClose }: { slot: LessonSlot; onClose: () => void }) {
  const t = useT();
  const entries = useTimetableStore((s) => s.entries);
  const upsertEntry = useTimetableStore((s) => s.upsertEntry);
  const removeEntry = useTimetableStore((s) => s.removeEntry);

  const [subject, setSubject] = useState(slot.entry?.subject ?? "");
  const [teacher, setTeacher] = useState(slot.entry?.teacher ?? "");
  const [room, setRoom] = useState(slot.entry?.room ?? "");
  const { start: startInit, end: endInit } = splitTime(slot.entry?.time ?? slot.periodTime);
  const [start, setStart] = useState(startInit);
  const [end, setEnd] = useState(endInit);
  const [wholeRow, setWholeRow] = useState(true);

  const entry = slot.entry;

  /** rewrites the time on every other entry of the period row */
  const applyRowTime = (period: number, time: string, keepId: string) => {
    const { entries, removeEntry: remove, upsertEntry: upsert } = useTimetableStore.getState();
    for (const e of entries) {
      const id = timetableRowId(e);
      if (e.period !== period || id === keepId || e.time === time) continue;
      remove(id);
      upsert({ ...e, time });
    }
  };

  const save = () => {
    const name = subject.trim();
    if (!name) return;
    const time = start && end ? `${start} - ${end}` : undefined;
    const next: TimetableEntry = {
      day: slot.day,
      period: slot.period,
      time,
      subject: name,
      teacher: teacher.trim() || undefined,
      room: room.trim() || undefined,
    };
    if (entry) {
      const oldId = timetableRowId(entry);
      const newId = timetableRowId(next);
      if (oldId !== newId) removeEntry(oldId);
    }
    upsertEntry(next);
    if (time && wholeRow) applyRowTime(slot.period, time, timetableRowId(next));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t(slot.day)} · ${slot.period}. ${t("Period")}`}
    >      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="lesson-subject">
              {t("Subject")}
            </label>
            <input
              id="lesson-subject"
              className="field"
              list="lesson-subject-list"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Mathe, Englisch, Physik…"
              required
              autoFocus
            />
            <datalist id="lesson-subject-list">
              {entries
                .map((e) => e.subject)
                .filter((n, i, a) => a.indexOf(n) === i)
                .map((n) => (
                  <option key={n} value={n} />
                ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="lesson-teacher">
                {t("Teacher")}
              </label>
              <input
                id="lesson-teacher"
                className="field"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lesson-room">
                {t("Room")}
              </label>
              <input
                id="lesson-room"
                className="field"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="lesson-start">
              {t("Time (optional)")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="lesson-start"
                type="time"
                className="field"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span className="font-mono text-xs text-ink-soft">–</span>
              <input
                aria-label={t("End")}
                type="time"
                className="field"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={wholeRow}
                disabled={!start || !end}
                onChange={(e) => setWholeRow(e.target.checked)}
              />
              {t("apply this time to the whole period row")}
            </label>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          {entry ? (
            <button
              type="button"
              className="btn-ghost hover:border-marker/40 hover:text-marker"
              onClick={() => {
                removeEntry(timetableRowId(entry));
                onClose();
              }}
            >
              <Trash2 className="size-4" /> {t("Delete")}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn-primary" disabled={!subject.trim()}>
            {t("Save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
