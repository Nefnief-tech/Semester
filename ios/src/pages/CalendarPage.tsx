/* Port of calendar/page.tsx + calendar/items.tsx + EventFormModal.tsx —
 * month grid (6 weeks starting Monday) and week list, with the auto-saving
 * event form. On iPad the month grid gets taller cells and the two panes sit
 * in a wider, centered column. */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable as RNPressable, ScrollView, Text, View } from 'react-native';

import { EventType, StudyEvent, Todo } from '../models/types';
import { useEventsStore } from '../stores/events_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { useTodosStore } from '../stores/todos_store';
import { EmptyState } from '../components/bits';
import { PageHeader, SegToggle, SemGhostButton, SemIconButton, SemLabel, SemPrimaryButton, SemSheet, SemTextField } from '../components/controls';
import { RoundCheck, SubjectSelect } from '../components/SubjectSelect';
import { Pressable } from '../components/motion';
import { usePaneWidth } from '../components/pane';
import { pickDate, pickTime } from '../components/pickers';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import { formatDayMonth, toDayKey } from '../utils/utils';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TYPE_ICONS: Record<EventType, string> = {
  study: '\uea19', // menu_book
  deadline: '\uf0c6', // flag
  exam: '\ue80c', // school
  event: '\ue878', // event
};

const TYPE_LABELS: Record<EventType, string> = {
  study: 'Study session',
  deadline: 'Deadline',
  exam: 'Exam',
  event: 'Event',
};

interface CalendarItem {
  event?: StudyEvent;
  todo?: Todo;
  time?: string | null;
  id: string;
}

function itemsForDay(events: StudyEvent[], todos: Todo[], dayKey: string): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const e of events) {
    if (e.date !== dayKey) continue;
    items.push({ event: e, time: e.time, id: e.id });
  }
  for (const todo of todos) {
    const due = todo.due;
    if (!due || !due.startsWith(dayKey)) continue;
    items.push({ todo, time: due.includes('T') ? due.split('T')[1] : null, id: todo.id });
  }
  items.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  return items;
}

function weekStartDate(d: Date): Date {
  const result = new Date(d);
  const diff = (d.getDay() === 0 ? 7 : d.getDay()) - 1;
  result.setDate(d.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function monthStartDate(cursor: Date): Date {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  return weekStartDate(first);
}

export function CalendarPage(): React.JSX.Element {
  const events = useEventsStore((s) => s.events);
  const todos = useTodosStore((s) => s.todos);
  const [monthView, setMonthView] = useState(true);
  const [cursor, setCursor] = useState(() => new Date());
  // form state: {date} for a new entry on a tapped day, {event} to edit
  const [form, setForm] = useState<{ date?: string; event?: StudyEvent } | null>(null);
  const { c, t } = useSem();
  const width = usePaneWidth();
  const regular = width >= 768;
  const horizontalPadding = regular ? 40 : 16;

  const move = (dir: number) => {
    setCursor((cur) => {
      if (monthView) return new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
      const next = new Date(cur);
      next.setDate(cur.getDate() + dir * 7);
      return next;
    });
  };

  const rangeLabel = monthView
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : (() => {
        const start = weekStartDate(cursor);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `${formatDayMonth(start)} – ${formatDayMonth(end)} ${end.getFullYear()}`;
      })();

  const monthStart = monthStartDate(cursor);
  const monthDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(monthStart.getDate() + i);
    return d;
  });
  const weekStart = weekStartDate(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const todayKey = toDayKey(new Date());

  const itemColor = (item: CalendarItem): string => {
    const subjects = useSubjectsStore.getState().subjects;
    const subjectId = item.event?.subjectId ?? item.todo?.subjectId;
    return subjects.find((s) => s.id === subjectId)?.color ?? '#756e60';
  };

  const renderMonthCell = (day: Date) => {
    const inMonth = day.getMonth() === cursor.getMonth();
    const dayKey = toDayKey(day);
    const items = itemsForDay(events, todos, dayKey);
    const isToday = dayKey === todayKey;
    return (
      <Pressable
        key={dayKey}
        onPress={() => setForm({ date: dayKey })}
        style={{
          flex: 1 / 7,
          minWidth: '14.28%',
          padding: 3,
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderColor: `${c.line}B3`,
          backgroundColor: !inMonth ? `${c.paperDeep}80` : 'transparent',
          minHeight: regular ? 76 : 58,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: isToday ? c.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={[
              t.labelSmall,
              {
                fontSize: 11,
                fontWeight: isToday ? '600' : '400',
                color: isToday ? c.paper : inMonth ? c.inkSoft : `${c.inkSoft}80`,
              },
            ]}
          >
            {day.getDate()}
          </Text>
        </View>
        <View style={{ height: 2 }} />
        {items.slice(0, 2).map((item) => (
          <View
            key={item.id}
            style={{ height: 5, marginBottom: 2, borderRadius: 2, backgroundColor: itemColor(item) }}
          />
        ))}
        {items.length > 2 ? (
          <Text style={[t.labelSmall, { fontSize: 8 }]}>+{items.length - 2}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <PageHeader
          title={rangeLabel}
          subtitle="deadlines, sessions & task due dates"
          trailing={
            <SemPrimaryButton onPress={() => setForm({})} style={{ marginTop: 8 }}>
              <Icon name="add" size={16} color={c.paper} />
              <View style={{ width: 6 }} />
              <Text style={[t.bodyMedium, { color: c.paper, fontWeight: '500' }]}>New entry</Text>
            </SemPrimaryButton>
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 10,
            }}
          >
            <SemIconButton icon="chevron_left" onPress={() => move(-1)} />
            <RNPressable onPress={() => setCursor(new Date())} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={[t.labelSmall, { letterSpacing: 1 }]}>TODAY</Text>
            </RNPressable>
            <SemIconButton icon="chevron_right" onPress={() => move(1)} />
          </View>
          <SegToggle<boolean>
            options={[
              [true, 'month'],
              [false, 'week'],
            ]}
            selected={monthView}
            onChanged={setMonthView}
          />
        </View>
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {(Object.keys(TYPE_LABELS) as EventType[]).map((type) => (
            <View key={type} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 12, lineHeight: 14, color: c.inkSoft }}>
                {TYPE_ICONS[type]}
              </Text>
              <View style={{ width: 4 }} />
              <Text style={[t.labelSmall, { fontSize: 9, letterSpacing: 0.8 }]}>
                {TYPE_LABELS[type].toUpperCase()}
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 12, lineHeight: 14, color: c.inkSoft }}>
              {'\uf0c6'}
            </Text>
            <View style={{ width: 4 }} />
            <Text style={[t.labelSmall, { fontSize: 9, letterSpacing: 0.8 }]}>
              DUE TASKS APPEAR AUTOMATICALLY
            </Text>
          </View>
        </View>
      </View>
      <View style={{ height: 12 }} />

      {monthView ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: horizontalPadding }}>
            {WEEKDAY_LABELS.map((d) => (
              <Text
                key={d}
                style={[t.labelSmall, { fontSize: 10, letterSpacing: 1, flex: 1, textAlign: 'center' }]}
              >
                {d[0]}
              </Text>
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: horizontalPadding, marginTop: 6 }} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: horizontalPadding }}>
            {monthDays.map(renderMonthCell)}
          </View>
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderTopWidth: 1,
              borderColor: c.line,
              backgroundColor: c.paper,
            }}
          >
            <Text style={[t.labelSmall, { fontSize: 10 }]}>
              Tap a day to schedule · open an entry from the week view or dashboard
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 24 }}>
          {weekDays.map((day, i) => {
            const dayKey = toDayKey(day);
            const items = itemsForDay(events, todos, dayKey);
            const isToday = dayKey === todayKey;
            return (
              <View
                key={dayKey}
                style={{
                  marginBottom: 12,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <Pressable onPress={() => setForm({ date: dayKey })}>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isToday ? c.accentSoft : 'transparent',
                      borderBottomWidth: 1,
                      borderColor: c.line,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={[t.labelSmall, { letterSpacing: 1.2 }]}>
                      {WEEKDAY_LABELS[i].toUpperCase()}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: isToday ? c.accent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={[t.labelMedium, { fontSize: 12, fontWeight: isToday ? '600' : '400', color: isToday ? c.paper : undefined }]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </View>
                </Pressable>
                <View style={{ padding: 8 }}>
                  {items.map((item) => (
                    <View key={item.id} style={{ marginBottom: 6 }}>
                      <CalendarChip
                        item={item}
                        color={itemColor(item)}
                        onTap={() => {
                          if (item.event) setForm({ event: item.event });
                          else if (item.todo) useTodosStore.getState().toggleTodo(item.todo.id);
                        }}
                      />
                    </View>
                  ))}
                  {items.length === 0 ? (
                    <Text style={[t.labelSmall, { fontSize: 10, textAlign: 'center', paddingVertical: 6 }]}>
                      free
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <SemSheet
        visible={form != null}
        title={form?.event ? 'Edit entry' : 'New entry'}
        onClose={() => setForm(null)}
      >
        {form ? <EventFormSheet date={form.date} event={form.event} onDone={() => setForm(null)} /> : null}
      </SemSheet>
    </View>
  );
}

/** port of the calendar Chip — colored bar + type icon + time + title */
function CalendarChip({
  item,
  color,
  onTap,
}: {
  item: CalendarItem;
  color: string;
  onTap: () => void;
}) {
  const { c, t } = useSem();
  const isTodo = item.event == null;
  const done = isTodo && item.todo!.done;
  const title = isTodo ? item.todo!.title : item.event!.title;
  const type: EventType = isTodo ? 'study' : item.event!.type;
  return (
    <Pressable
      onPress={onTap}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 8,
      }}
    >
      <View style={{ width: 3, height: 15, borderRadius: 999, backgroundColor: color }} />
      <View style={{ width: 6 }} />
      {isTodo ? (
        // decorative here — the wrapping chip handles the tap (a nested
        // handler would toggle the todo twice)
        <RoundCheck done={done} size={13} />
      ) : (
        <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 13, lineHeight: 15, color: c.inkSoft }}>
          {TYPE_ICONS[type]}
        </Text>
      )}
      {item.time ? (
        <>
          <View style={{ width: 5 }} />
          <Text style={[t.labelSmall, { fontSize: 10 }]}>{item.time}</Text>
        </>
      ) : null}
      <View style={{ width: 6 }} />
      <Text
        numberOfLines={1}
        style={[
          t.bodySmall,
          {
            fontSize: 11,
            flex: 1,
            textDecorationLine: done ? 'line-through' : 'none',
            color: done ? c.inkSoft : c.ink,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* ---------------- event form (auto-save) ---------------- */

function EventFormSheet({
  date,
  event,
  onDone,
}: {
  date?: string;
  event?: StudyEvent;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [type, setType] = useState<EventType>(event?.type ?? 'study');
  const [day, setDay] = useState<string | null>(event?.date ?? date ?? null);
  const [time, setTime] = useState<string | null | undefined>(event?.time);
  const [subjectId, setSubjectId] = useState<string | null | undefined>(event?.subjectId);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const createdId = useRef<string | null>(null);
  const stateRef = useRef({ title, notes, type, day, time, subjectId });
  stateRef.current = { title, notes, type, day, time, subjectId };

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (dirty.current) commit(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function commitSoon() {
    dirty.current = true;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => commit(false), 400);
  }

  function commitNow() {
    dirty.current = true;
    if (debounce.current) clearTimeout(debounce.current);
    // deferred one tick: the setState call before this re-renders and only
    // then updates stateRef — a synchronous read would see the old value
    setTimeout(() => commit(false), 0);
  }

  /** writes the form into the store; the close-time flush (`relaxed`) falls
   * back to "Untitled"/today when content exists but title/date are missing */
  function commit(relaxed: boolean) {
    const s = stateRef.current;
    const trimmedTitle = s.title.trim();
    const trimmedNotes = s.notes.trim();
    const isCreate = !event && !createdId.current;
    const hasExtras =
      trimmedNotes !== '' || s.time != null || s.subjectId != null || s.type !== 'study';
    const t2 = trimmedTitle === '' && relaxed && isCreate && hasExtras ? 'Untitled' : trimmedTitle;
    if (t2 === '') return;
    const d = s.day || (relaxed && isCreate ? toDayKey(new Date()) : null);
    if (!d) return;
    const store = useEventsStore.getState();
    const id = event?.id ?? createdId.current;
    if (id) {
      const current = store.events.find((x) => x.id === id);
      if (!current) return;
      store.updateEvent(id, {
        title: t2,
        date: d,
        time: s.time ?? null,
        type: s.type,
        subjectId: s.subjectId ?? null,
        notes: trimmedNotes === '' ? null : trimmedNotes,
      });
    } else {
      createdId.current = store.addEvent({
        title: t2,
        date: d,
        time: s.time ?? undefined,
        type: s.type,
        subjectId: s.subjectId ?? undefined,
        notes: trimmedNotes === '' ? undefined : trimmedNotes,
      });
    }
  }

  function flushAndClose() {
    if (debounce.current) clearTimeout(debounce.current);
    if (dirty.current) {
      dirty.current = false;
      commit(true);
    }
    onDone();
  }

  const { c, t } = useSem();

  const pickerField = (icon: React.ComponentProps<typeof Icon>['name'], label: string, onTap: () => void) => (
    <Pressable
      onPress={onTap}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
      }}
    >
      <Icon name={icon} size={14} color={c.inkSoft} />
      <View style={{ width: 8 }} />
      <Text numberOfLines={1} style={[t.labelMedium, { fontSize: 13, color: label === '—' ? c.inkSoft : c.ink, flex: 1 }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <SemLabel text="Title" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={title}
        autoFocus={!event}
        placeholder="e.g. Library session, History midterm…"
        onChangeText={(v) => {
          setTitle(v);
          commitSoon();
        }}
      />
      <View style={{ height: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SemLabel text="Date" />
          <View style={{ height: 6 }} />
          {pickerField('calendar_today', day ?? '—', async () => {
            const picked = await pickDate(day);
            if (picked && picked !== day) {
              setDay(picked);
              commitNow();
            }
          })}
        </View>
        <View style={{ flex: 1 }}>
          <SemLabel text="Time (optional)" />
          <View style={{ height: 6 }} />
          {pickerField('schedule', time ?? '—', async () => {
            const picked = await pickTime(time ?? null);
            if (picked && picked !== time) {
              setTime(picked);
              commitNow();
            }
          })}
        </View>
      </View>
      <View style={{ height: 14 }} />
      <SemLabel text="Type" />
      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(TYPE_LABELS) as EventType[]).map((et) => (
          <Pressable
            key={et}
            onPress={() => {
              setType(et);
              commitNow();
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 10,
              borderWidth: 1,
              backgroundColor: type === et ? c.ink : c.card,
              borderColor: type === et ? c.ink : c.line,
            }}
          >
            <Text
              style={[t.bodySmall, { fontSize: 12, fontWeight: '500', color: type === et ? c.paper : c.inkSoft }]}
            >
              {TYPE_LABELS[et]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 14 }} />
      <SubjectSelect
        value={subjectId ?? null}
        onChanged={(v) => {
          setSubjectId(v);
          commitNow();
        }}
      />
      <View style={{ height: 14 }} />
      <SemLabel text="Notes (optional)" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={notes}
        multiline
        placeholder="Room, materials to bring…"
        onChangeText={(v) => {
          setNotes(v);
          commitSoon();
        }}
      />
      <View style={{ height: 18 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {event ? (
          <SemGhostButton
            foreground={c.marker}
            border={`${c.marker}66`}
            onPress={() => {
              if (debounce.current) clearTimeout(debounce.current);
              dirty.current = false;
              useEventsStore.getState().removeEvent(event.id);
              onDone();
            }}
          >
            <Icon name="delete" size={16} color={c.marker} />
            <View style={{ width: 6 }} />
            <Text style={[t.bodyMedium, { color: c.marker }]}>Delete</Text>
          </SemGhostButton>
        ) : (
          <Text style={[t.labelSmall, { color: c.inkSoft, flex: 1 }]}>Saves automatically</Text>
        )}
        <View style={{ flex: 1 }} />
        <SemPrimaryButton onPress={flushAndClose}>Done</SemPrimaryButton>
      </View>
    </View>
  );
}
