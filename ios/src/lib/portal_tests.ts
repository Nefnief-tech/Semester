/* Port of `src/lib/portalTests.ts` — mirrors the portal's upcoming
 * Schulaufgaben into the Tasks list. One task per test; its due date puts it
 * on the calendar automatically, so a single entity serves both places. */

import { PortalTest, Todo } from '../models/types';
import { useEventsStore } from '../stores/events_store';
import { useTodosStore } from '../stores/todos_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { hashId } from '../utils/utils';

export const PORTAL_TEST_NOTES =
  'auto-imported from the Eltern-Portal — title, date and subject are overwritten on the next portal fetch';

/** deterministic todo id — byte-identical on every device, so web and phone
 *  upsert the same cloud row instead of importing the test twice */
export function portalTestTodoId(t: PortalTest): string {
  return `portal-${hashId(`portalTest|${t.sourceId}|${t.date}`)}`;
}

/** best-effort subject link: the part after "in"/":" matched against the
 *  subject list (exact, else containment with ≥3 chars) */
function subjectIdForTitle(title: string, subjects: Array<{ id: string; name: string }>): string | undefined {
  const m = title.match(/\b(?:in|:)\s*(.+?)\s*$/i);
  const name = (m?.[1] ?? title).toLowerCase().trim();
  if (name.length === 0) return undefined;
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
 * Task ids carry the "portal-" prefix and follow the same snapshot rule as
 * the substitution plan: the fetch is authoritative, so tasks that dropped
 * out of the feed are removed again. Ticking a task off (and its createdAt)
 * is the user's business and survives re-fetches; everything else mirrors
 * the feed. Also removes the calendar-event mirror this replaced.
 */
export function syncPortalTestTasks(tests: PortalTest[]): void {
  // migration: the earlier build mirrored tests as exam events — drop those
  const events = useEventsStore.getState();
  for (const e of events.events) {
    if (e.id.startsWith('portal-')) events.removeOne(e.id);
  }

  const store = useTodosStore.getState();
  const subjects = useSubjectsStore.getState().subjects;

  const wanted = new Map<string, Todo>();
  for (const t of tests) {
    const id = portalTestTodoId(t);
    wanted.set(id, {
      id,
      title: t.title,
      notes: PORTAL_TEST_NOTES,
      due: t.time ? `${t.date}T${t.time}` : t.date,
      priority: 'high',
      subjectId: subjectIdForTitle(t.title, subjects),
      done: false,
      createdAt: 0, // set once at creation; never overwritten afterwards
    });
  }

  for (const t of store.todos) {
    if (t.id.startsWith('portal-') && !wanted.has(t.id)) store.removeOne(t.id);
  }

  const current = useTodosStore.getState().todos;
  for (const [id, want] of wanted) {
    const existing = current.find((t) => t.id === id);
    if (!existing) {
      store.upsertOne({ ...want, createdAt: Date.now() });
      continue;
    }
    // the user's own notes win — canonical notes only for untouched tasks
    const notes =
      existing.notes != null && existing.notes !== PORTAL_TEST_NOTES
        ? existing.notes
        : PORTAL_TEST_NOTES;
    if (
      existing.title === want.title &&
      existing.due === want.due &&
      existing.priority === want.priority &&
      existing.subjectId === want.subjectId &&
      existing.notes === notes
    ) {
      continue; // unchanged — a no-op write would trigger a pointless row push
    }
    store.updateTodo(id, {
      title: want.title,
      due: want.due,
      priority: want.priority,
      subjectId: want.subjectId,
      notes,
    });
  }
}
