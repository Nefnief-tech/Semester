/* Port of the web dashboard (`src/app/page.tsx`) via `dashboard_page.dart` —
 * today's reality first, then the queue, the week, the numbers. On iPad the
 * queue and the week sit side by side and everything breathes within a
 * readable max width. */

import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { EventType, Homework, Subject, Todo, Tone } from '../models/types';
import { useNav } from '../navigation';
import { useAuthStore } from '../stores/auth_store';
import { useEventsStore } from '../stores/events_store';
import { useGradesStore } from '../stores/grades_store';
import { useHomeworkStore } from '../stores/homework_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { useTodosStore } from '../stores/todos_store';
import { DueChip, EmptyState, SubjectDot, SubjectTag } from '../components/bits';
import { SemCard, SemLabel, confirmDialog } from '../components/controls';
import { RoundCheck } from '../components/SubjectSelect';
import { Pressable } from '../components/motion';
import { usePaneWidth } from '../components/pane';
import { toneColor, useSem } from '../theme/theme';
import {
  dayKeyLabel,
  dueInfo,
  findSubject,
  formatPoints,
  longDateLabel,
  pointsTone,
  toDayKey,
  weightedAverage,
} from '../utils/utils';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface UpcomingItem {
  isHomework: boolean;
  todo?: Todo;
  homework?: Homework;
  sortKey: number;
}

const SORT_MISSING = Number.MAX_SAFE_INTEGER;

function collectUpcoming(todos: Todo[], homeworks: Homework[]): UpcomingItem[] {
  return [
    ...todos.filter((t) => !t.done).map((todo) => ({
      isHomework: false,
      todo,
      sortKey: dueInfo(todo.due)?.date.getTime() ?? SORT_MISSING,
    })),
    ...homeworks.filter((h) => !h.done).map((homework) => ({
      isHomework: true,
      homework,
      sortKey: dueInfo(homework.due)?.date.getTime() ?? SORT_MISSING,
    })),
  ].sort((a, b) => a.sortKey - b.sortKey);
}

interface ScheduleEntry {
  kind: 'event' | 'todo' | 'homework';
  event?: Todo | Homework | import('../models/types').StudyEvent;
  todo?: Todo;
  homework?: Homework;
}

export function DashboardPage(): React.JSX.Element {
  const todos = useTodosStore((s) => s.todos);
  const homeworks = useHomeworkStore((s) => s.homeworks);
  const events = useEventsStore((s) => s.events);
  const subjects = useSubjectsStore((s) => s.subjects);
  const entries = useGradesStore((s) => s.entries);
  const online = useAuthStore((s) => s.online);
  const { c, t } = useSem();
  const width = usePaneWidth();
  const regular = width >= 768;
  const contentWidth = Math.min(920, width - (regular ? 96 : 32));

  const openTodos = todos.filter((x) => !x.done);
  const openHomework = homeworks.filter((x) => !x.done);
  const now = new Date();
  const dueToday = openTodos.filter((x) => dueInfo(x.due)?.isToday ?? false).length;
  const overall = weightedAverage(entries);
  const upcoming = useMemo(() => collectUpcoming(todos, homeworks), [todos, homeworks]);

  // next 7 days schedule: events + open todo/homework due dates
  const startKey = toDayKey(now);
  const endKey = toDayKey(new Date(now.getTime() + 6 * 86400000));
  const buckets = new Map<string, ScheduleEntry[]>();
  const push = (key: string, item: ScheduleEntry) => {
    if (key < startKey || key > endKey) return;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  };
  for (const e of events) push(e.date, { kind: 'event', event: e });
  for (const todo of openTodos) if (todo.due) push(todo.due.slice(0, 10), { kind: 'todo', todo });
  for (const hw of openHomework) if (hw.due) push(hw.due.slice(0, 10), { kind: 'homework', homework: hw });
  const schedule = [...buckets.keys()].sort();

  // hierarchy: today's reality first, then the queue, the week, numbers
  const endOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const todayFocus = upcoming.filter((u) => u.sortKey <= endOfTodayMs);
  const hasOverdue = todayFocus.some((u) => u.sortKey < now.getTime());
  const restUpcoming = upcoming.slice(todayFocus.length);
  const isEmpty = todos.length === 0 && events.length === 0 && subjects.length === 0;

  const upNextSection = (
    <View>
      <SectionHeader
        title="Up next"
        actionLabel="all tasks →"
        onAction={() => useNav.getState().handle('tasks')}
      />
      {restUpcoming.length === 0 && todayFocus.length === 0 ? (
        <EmptyState title="All clear" hint="No open tasks or homework. Enjoy the calm." />
      ) : restUpcoming.length === 0 ? (
        <Text style={[t.labelSmall, { color: c.inkSoft }]}>nothing else queued</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {restUpcoming.slice(0, 5).map((item, i) => (
            <UpcomingRow key={`${item.todo?.id ?? item.homework?.id ?? i}`} item={item} />
          ))}
        </View>
      )}
    </View>
  );

  const weekSection = (
    <View>
      <SectionHeader
        title="Next 7 days"
        actionLabel="calendar →"
        onAction={() => useNav.getState().handle('calendar')}
      />
      {schedule.length === 0 ? (
        <EmptyState
          title="Quiet week"
          hint="No sessions, exams or deadlines in the next 7 days."
        />
      ) : (
        <View>
          {schedule.map((key) => (
            <View key={key} style={{ marginBottom: 8 }}>
              <Text style={[t.labelSmall, { letterSpacing: 1.2, marginBottom: 6 }]}>
                {dayKeyLabel(key).toUpperCase()}
              </Text>
              {buckets.get(key)!.map((item, i) => (
                <View key={i} style={{ marginBottom: 6 }}>
                  <ScheduleRow item={item} />
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: contentWidth, paddingHorizontal: regular ? 0 : 16, paddingTop: 16, paddingBottom: 32 }}>
        <Text style={[t.labelSmall, { letterSpacing: 1.6 }]}>
          {longDateLabel(now).toUpperCase()}
        </Text>
        <View style={{ height: 8 }} />
        <Text style={t.displayLarge}>
          {greeting()}.
          <Text style={{ color: c.accent, fontStyle: 'italic' }}>
            {dueToday > 0
              ? ` ${dueToday} ${dueToday === 1 ? 'task' : 'tasks'} due today.`
              : ' Nothing due today.'}
          </Text>
        </Text>
        {isEmpty ? (
          <View style={{ marginTop: 24 }}>
            <EmptyState
              icon="auto_awesome"
              title="Your desk is empty"
              hint="Add a subject, a task or a calendar entry to get started."
            />
          </View>
        ) : null}
        <View style={{ height: 20 }} />

        {/* TODAY — the focus: overdue + due today, concretely */}
        <TodayHero items={todayFocus} hasOverdue={hasOverdue} online={online} />
        <View style={{ height: 28 }} />

        {regular ? (
          <View style={{ flexDirection: 'row', gap: 28 }}>
            <View style={{ flex: 1 }}>{upNextSection}</View>
            <View style={{ flex: 1 }}>{weekSection}</View>
          </View>
        ) : (
          <>
            {upNextSection}
            <View style={{ height: 32 }} />
            {weekSection}
          </>
        )}

        {/* numbers — quiet, at the end */}
        <View style={{ height: 32 }} />
        <SummaryStrip
          tasks={openTodos.length}
          homework={openHomework.length}
          grade={overall == null ? null : formatPoints(overall)}
        />

        {/* subject averages */}
        {subjects.length > 0 ? (
          <>
            <View style={{ height: 32 }} />
            <SectionHeader
              title="Subjects"
              actionLabel="manage grades →"
              onAction={() => useNav.getState().handle('grades')}
            />
            <SemCard padding={{ x: 20, y: 4 }}>
              {subjects.map((s) => (
                <SubjectRow
                  key={s.id}
                  subject={s}
                  avg={weightedAverage(entries.filter((e) => e.subjectId === s.id))}
                />
              ))}
            </SemCard>
          </>
        ) : null}

        {/* danger zone */}
        <View style={{ height: 40, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={async () => {
              const ok = await confirmDialog(
                'Delete all tasks, homework, grades, events and subjects? This cannot be undone.',
                { title: 'Clear all data', confirmLabel: 'Clear everything' },
              );
              if (ok) {
                useTodosStore.getState().clearAll();
                useHomeworkStore.getState().clearAll();
                useGradesStore.getState().clearAll();
                useEventsStore.getState().clearAll();
                useSubjectsStore.getState().clearAll();
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}
          >
            <Text style={[t.labelSmall, { color: `${c.inkSoft}B3` }]}>clear all data</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ---------------- pieces ---------------- */

/** the dashboard focus: everything due today (or overdue), concretely —
 * tinted border when attention is needed, calm statement when clear */
function TodayHero({
  items,
  hasOverdue,
  online,
}: {
  items: UpcomingItem[];
  hasOverdue: boolean;
  online: boolean;
}) {
  const { c, t } = useSem();
  const calm = items.length === 0;
  const borderColor = calm
    ? c.line
    : hasOverdue
      ? `${c.marker}8C`
      : `${c.accent}80`;

  const toggle = (item: UpcomingItem) => {
    if (item.isHomework && item.homework) {
      useHomeworkStore.getState().toggleHomework(item.homework.id);
    } else if (item.todo) {
      useTodosStore.getState().toggleTodo(item.todo.id);
    }
  };

  return (
    <SemCard borderColor={borderColor} padding={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SemLabel text="today" />
        <View style={{ flex: 1 }} />
        {hasOverdue ? (
          <Text style={[t.labelSmall, { color: c.marker, fontWeight: '600', letterSpacing: 1.2 }]}>
            OVERDUE
          </Text>
        ) : null}
      </View>
      <View style={{ height: 4 }} />
      {calm ? (
        <Text style={[t.bodyMedium, { color: c.inkSoft, fontStyle: 'italic' }]}>
          Nothing due — the desk is calm.
        </Text>
      ) : null}
      {items.slice(0, 3).map((item, i) => {
        const overdue = item.sortKey < Date.now();
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <RoundCheck done={false} onTap={() => toggle(item)} size={20} />
            <View style={{ width: 10 }} />
            <Text numberOfLines={1} style={[t.bodyMedium, { flex: 1, fontWeight: '500' }]}>
              {item.isHomework ? item.homework!.title : item.todo!.title}
            </Text>
            <View style={{ width: 8 }} />
            <Text
              style={[
                t.labelSmall,
                {
                  fontSize: 9,
                  letterSpacing: 0.6,
                  color: overdue ? c.marker : c.inkSoft,
                },
              ]}
            >
              {(dueInfo(item.isHomework ? item.homework!.due : item.todo!.due)?.label ?? '').toUpperCase()}
            </Text>
          </View>
        );
      })}
      {items.length > 3 ? (
        <Text style={[t.labelSmall, { color: c.inkSoft, marginTop: 8 }]}>
          +{items.length - 3} more today
        </Text>
      ) : null}
      {!online ? (
        <>
          <View style={{ height: 6 }} />
          <Text style={[t.labelSmall, { fontSize: 9, color: `${c.inkSoft}B3` }]}>
            offline — saved locally
          </Text>
        </>
      ) : null}
    </SemCard>
  );
}

/** the numbers, quiet at the end: one strip instead of five shouty cards */
function SummaryStrip({ tasks, homework, grade }: { tasks: number; homework: number; grade?: string | null }) {
  const { c, t } = useSem();
  const cells: Array<[string, string, string]> = [
    ['tasks', String(tasks), 'tasks'],
    ['homework', String(homework), 'homework'],
    ['grade', grade ?? '—', 'grades'],
  ];
  return (
    <SemCard padding={{ x: 0, y: 14 }}>
      <View style={{ flexDirection: 'row' }}>
        {cells.map(([label, value, route], i) => (
          <React.Fragment key={label}>
            {i > 0 ? <View style={{ width: 1, height: 30, backgroundColor: c.line, alignSelf: 'center' }} /> : null}
            <Pressable
              onPress={() => useNav.getState().handle(route)}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <Text style={[t.titleMedium, { fontWeight: '600' }]}>{value}</Text>
              <View style={{ height: 2 }} />
              <Text style={[t.labelSmall, { fontSize: 8, letterSpacing: 1.2, color: c.inkSoft }]}>
                {label.toUpperCase()}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </SemCard>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = useSem();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
      <Text style={[t.headlineSmall, { flex: 1 }]}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={6}>
          <Text style={[t.labelSmall, { letterSpacing: 1 }]}>{actionLabel.toUpperCase()}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const subjects = useSubjectsStore((s) => s.subjects);
  const { c, t } = useSem();
  const hw = item.homework;
  const todo = item.todo;
  const title = item.isHomework ? hw!.title : todo!.title;
  const due = item.isHomework ? hw!.due : todo!.due;
  const subject = findSubject(subjects, item.isHomework ? hw!.subjectId : todo!.subjectId);
  const done = false;

  return (
    <View
      style={{
        padding: 14,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <RoundCheck
        done={false}
        size={20}
        onTap={() => {
          if (item.isHomework && hw) useHomeworkStore.getState().toggleHomework(hw.id);
          else if (todo) useTodosStore.getState().toggleTodo(todo.id);
        }}
      />
      <View style={{ width: 10 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.isHomework ? (
            <>
              <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 13, lineHeight: 16, color: c.accent }}>
                {'\uea19'}
              </Text>
              <View style={{ width: 5 }} />
            </>
          ) : null}
          <Text numberOfLines={1} style={[t.bodyMedium, { flex: 1, fontWeight: '500' }]}>
            {title}
          </Text>
        </View>
        <View style={{ height: 5 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {subject ? <SubjectTag name={subject.name} color={subject.color} /> : null}
          <DueChip due={due} done={done} />
        </View>
      </View>
    </View>
  );
}

function SubjectRow({ subject, avg }: { subject: Subject; avg?: number | null }) {
  const { c, t } = useSem();
  const tone: Tone = avg == null ? 'neutral' : pointsTone(avg);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <SubjectDot color={subject.color} size={10} />
      <View style={{ width: 10 }} />
      <Text numberOfLines={1} style={[t.bodyMedium, { width: 110, fontWeight: '500' }]}>
        {subject.name}
      </Text>
      <View
        style={{
          flex: 1,
          height: 6,
          borderRadius: 999,
          backgroundColor: c.paperDeep,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${avg == null ? 0 : Math.min(100, Math.max(0, (avg / 100) * 100))}%` as `${number}%`,
            height: '100%',
            backgroundColor: toneColor(c, tone),
          }}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[t.labelMedium, { width: 46, textAlign: 'right', color: c.ink, fontWeight: '600' }]}
      >
        {avg == null ? '—' : formatPoints(avg)}
      </Text>
    </View>
  );
}

function ScheduleRow({ item }: { item: ScheduleEntry }) {
  const { c, t } = useSem();
  const subjects = useSubjectsStore((s) => s.subjects);

  if (item.kind === 'homework' && item.homework) {
    return (
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 7,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 12, lineHeight: 14, color: c.inkSoft }}>
          {'\uea19'}
        </Text>
        <View style={{ width: 6 }} />
        <Text numberOfLines={1} style={[t.bodyMedium, { flex: 1 }]}>
          {item.homework.title}
        </Text>
      </View>
    );
  }

  // port of calendar/items.tsx Chip
  const event = item.kind === 'event' ? (item.event as import('../models/types').StudyEvent) : undefined;
  const todo = item.todo;
  const subject = findSubject(subjects, event ? event.subjectId : todo?.subjectId);
  const title = event ? event.title : todo!.title;
  const time = event ? event.time : (todo!.due ?? '').includes('T') ? todo!.due!.split('T')[1] : undefined;
  const type: EventType = event ? event.type : 'study';
  const color = subject?.color ?? '#756e60';
  const typeIcon = type === 'study' ? 'menu_book' : type === 'deadline' ? 'flag' : type === 'exam' ? 'school' : 'event';

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 7,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ width: 3, height: 14, borderRadius: 999, backgroundColor: color }} />
      <View style={{ width: 6 }} />
      <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 12, lineHeight: 14, color: c.inkSoft }}>
        {typeIcon === 'menu_book' ? '\uea19' : typeIcon === 'flag' ? '\uf0c6' : typeIcon === 'school' ? '\ue80c' : '\ue878'}
      </Text>
      {!todo && time ? (
        <>
          <View style={{ width: 4 }} />
          <Text style={t.labelSmall}>{time}</Text>
        </>
      ) : null}
      <View style={{ width: 6 }} />
      <Text numberOfLines={1} style={[t.bodySmall, { fontSize: 11, flex: 1 }]}>
        {title}
      </Text>
    </View>
  );
}
