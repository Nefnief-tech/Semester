"use client";

import type { PortalTest } from "@/lib/server/portal";
import type { StudyEvent } from "@/lib/types";
import { useEventsStore } from "@/lib/store/events";
import { useSubjectsStore } from "@/lib/store/subjects";
import { hashId } from "@/lib/utils";

export const PORTAL_TEST_NOTES =
  "auto-imported from the Eltern-Portal — title, date and subject are overwritten on the next portal fetch";

/** deterministic event id — byte-identical on every device, so web and phone
 *  upsert the same cloud row instead of importing the test twice */
export const portalTestEventId = (t: PortalTest) =>
  `portal-${hashId(`portalTest|${t.sourceId}|${t.date}`)}`;

/** best-effort subject link: the part after "in"/":" matched against the
 *  subject list (exact, else containment with ≥3 chars) */
function subjectIdForTitle(title: string, subjects: Array<{ id: string; name: string }>) {
  const m = title.match(/\b(?:in|:)\s*(.+?)\s*$/i);
  const name = (m?.[1] ?? title).toLowerCase();
  if (!name) return undefined;
  const exact = subjects.find((s) => s.name.trim().toLowerCase() === name);
  if (exact) return exact.id;
  if (name.length < 3) return undefined;
  return subjects.find(
    (s) =>
      s.name.trim().toLowerCase().length >= 3 &&
      (s.name.trim().toLowerCase().includes(name) || name.includes(s.name.trim().toLowerCase())),
  )?.id;
}

/**
 * Mirrors the portal's upcoming Schulaufgaben into the calendar as exam
 * events. Portal-sourced events (id prefix "portal-") follow the same
 * snapshot rule as the substitution plan: the fetch is authoritative, so
 * events that dropped out of the feed are removed again. User-written notes
 * survive; everything else mirrors the feed.
 */
export function syncPortalTestEvents(tests: PortalTest[]): void {
  const store = useEventsStore.getState();
  const subjects = useSubjectsStore.getState().subjects;

  const wanted = new Map<string, StudyEvent>();
  for (const t of tests) {
    wanted.set(portalTestEventId(t), {
      id: portalTestEventId(t),
      title: t.title,
      date: t.date,
      time: t.time,
      type: "exam",
      subjectId: subjectIdForTitle(t.title, subjects),
      notes: PORTAL_TEST_NOTES,
    });
  }

  for (const e of store.events) {
    if (e.id.startsWith("portal-") && !wanted.has(e.id)) store.removeOne(e.id);
  }

  const current = useEventsStore.getState().events;
  for (const [id, ev] of wanted) {
    const existing = current.find((e) => e.id === id);
    // the user's own notes win — canonical notes only for untouched events
    const notes =
      existing && existing.notes !== undefined && existing.notes !== PORTAL_TEST_NOTES
        ? existing.notes
        : PORTAL_TEST_NOTES;
    const next: StudyEvent = { ...ev, notes };
    if (
      existing &&
      existing.title === next.title &&
      existing.date === next.date &&
      existing.time === next.time &&
      existing.type === next.type &&
      existing.subjectId === next.subjectId &&
      existing.notes === next.notes
    ) {
      continue; // unchanged — a no-op write would trigger a pointless row push
    }
    store.upsertOne(next);
  }
}
