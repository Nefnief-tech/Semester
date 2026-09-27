/* Port of `lib/services/widgets.dart` — the agenda/timetable payload builder
 * is 1:1 with the Android widgets. On iOS, home-screen widgets are WidgetKit
 * extensions that read this payload from an app-group UserDefaults; the
 * native target is a deliberate follow-up (see README) — the payload logic
 * and refresh cadence already live here so the extension only needs a
 * reader. */

import { useEventsStore } from '../stores/events_store';
import { useHomeworkStore } from '../stores/homework_store';
import { useThemeStore } from '../stores/theme_store';
import { useTimetableStore } from '../stores/timetable_store';
import { useTodosStore } from '../stores/todos_store';
import { dueInfo, parseDue } from '../utils/utils';

export interface AgendaItem {
  tag: string;
  title: string;
  meta: string;
  overdue: boolean;
}

export interface WidgetsPayload {
  dark: boolean;
  agenda: { items: AgendaItem[]; total: number };
  timetable: {
    day: string;
    items: Array<{ period: string; time: string; subject: string; room: string }>;
  };
}

export function buildWidgetPayload(systemDark: boolean): WidgetsPayload {
  const stores = {
    homework: useHomeworkStore.getState(),
    todos: useTodosStore.getState(),
    events: useEventsStore.getState(),
    timetable: useTimetableStore.getState(),
  };
  const dark = useThemeStore.getState().dark ?? systemDark;

  // ---- agenda: homework · tasks · events, soonest first ----
  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 86400000);
  const agenda: Array<AgendaItem & { sort: number }> = [];
  for (const hw of stores.homework.homeworks.filter((h) => !h.done)) {
    const d = parseDue(hw.due ?? '');
    if (!d || d.getTime() < now.getTime() - 86400000) continue;
    agenda.push({
      tag: 'HW',
      title: hw.title,
      meta: dueInfo(hw.due)?.label ?? '',
      overdue: d.getTime() < now.getTime(),
      sort: d.getTime(),
    });
  }
  for (const t of stores.todos.todos.filter((t) => !t.done)) {
    const d = parseDue(t.due ?? '');
    if (!d || d.getTime() < now.getTime() - 86400000) continue;
    agenda.push({
      tag: 'TSK',
      title: t.title,
      meta: dueInfo(t.due)?.label ?? '',
      overdue: d.getTime() < now.getTime(),
      sort: d.getTime(),
    });
  }
  for (const e of stores.events.events) {
    const time = (e.time ?? '00:00').padStart(5, '0');
    const d = parseDue(`${e.date}T${time}`);
    if (!d || d.getTime() < now.getTime() - 86400000 || d.getTime() > horizon.getTime()) continue;
    agenda.push({
      tag: e.type === 'exam' ? 'EXAM' : 'CAL',
      title: e.title,
      meta: dueInfo(e.date)?.label ?? '',
      overdue: false,
      sort: d.getTime(),
    });
  }
  agenda.sort((a, b) => a.sort - b.sort);

  // ---- timetable: today's lessons ----
  const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayKey = dayKeys[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const lessons = stores.timetable.entries
    .filter((e) => e.day === todayKey)
    .sort((a, b) => a.period - b.period);

  return {
    dark,
    agenda: {
      items: agenda.slice(0, 12).map(({ tag, title, meta, overdue }) => ({ tag, title, meta, overdue })),
      total: agenda.length,
    },
    timetable: {
      day: todayKey,
      items: lessons.map((e) => ({
        period: String(e.period),
        time: (e.time ?? '').split('-')[0].trim(),
        subject: e.subject,
        room: e.room ?? '',
      })),
    },
  };
}
