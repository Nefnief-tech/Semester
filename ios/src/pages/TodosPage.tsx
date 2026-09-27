/* Port of todos/page.tsx + TodoFormModal.tsx — filters, subject chips, and
 * the auto-saving form sheet (text edits commit debounced, discrete picks
 * immediately, close-time flush falls back to "Untitled"). */

import React, { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';

import { Priority, Todo } from '../models/types';
import { useSubjectsStore } from '../stores/subjects_store';
import { useTodosStore } from '../stores/todos_store';
import { DueChip, EmptyState, PriorityBadge, SubjectDot, SubjectTag } from '../components/bits';
import { PageHeader, SegToggle, SemGhostButton, SemIconButton, SemLabel, SemPrimaryButton, SemSheet, SemTextField } from '../components/controls';
import { RoundCheck, SubjectSelect } from '../components/SubjectSelect';
import { Pressable } from '../components/motion';
import { dueLabel, pickDueDateTime } from '../components/pickers';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import { PRIORITY_LABEL, PRIORITY_ORDER, dueInfo, findSubject } from '../utils/utils';

type StatusFilter = 'open' | 'done' | 'all';

export function TodosPage(): React.JSX.Element {
  const todos = useTodosStore((s) => s.todos);
  const subjects = useSubjectsStore((s) => s.subjects);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [sortByPriority, setSortByPriority] = useState(false);
  const [creating, setCreating] = useState(false);
  const { c, t } = useSem();

  let list = todos;
  if (status !== 'all') list = list.filter((x) => (status === 'done' ? x.done : !x.done));
  if (subjectFilter) list = list.filter((x) => x.subjectId === subjectFilter);
  const sorted = [...list].sort((a, b) => {
    if (sortByPriority) {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
    }
    const da = dueInfo(a.due)?.date.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = dueInfo(b.due)?.date.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return a.createdAt - b.createdAt;
  });

  const openCount = todos.filter((x) => !x.done).length;

  const filterChip = (subjectId: string | null, label: string, color?: string) => {
    const selected = subjectFilter === subjectId;
    return (
      <Pressable
        key={subjectId ?? 'all'}
        onPress={() => setSubjectFilter(selected ? null : subjectId)}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? c.ink : c.line,
          backgroundColor: selected ? c.ink : c.paper,
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 6,
        }}
      >
        {color ? (
          <>
            <SubjectDot color={color} size={8} />
            <View style={{ width: 5 }} />
          </>
        ) : null}
        <Text style={[t.bodySmall, { fontSize: 11, color: selected ? c.paper : c.ink }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <PageHeader
          title="Tasks"
          subtitle={`${openCount} open · ${todos.length - openCount} done`}
          trailing={
            <SemPrimaryButton onPress={() => setCreating(true)} style={{ marginTop: 8 }}>
              <Icon name="add" size={16} color={c.paper} />
              <View style={{ width: 6 }} />
              <Text style={[t.bodyMedium, { color: c.paper, fontWeight: '500' }]}>New task</Text>
            </SemPrimaryButton>
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SegToggle<StatusFilter>
            options={[
              ['open', 'open'],
              ['done', 'done'],
              ['all', 'all'],
            ]}
            selected={status}
            onChanged={setStatus}
          />
          <SemGhostButton onPress={() => setSortByPriority(!sortByPriority)}>
            <Icon name="swap_vert" size={15} color={c.inkSoft} />
            <View style={{ width: 5 }} />
            <Text style={[t.bodySmall, { color: c.inkSoft }]}>
              {sortByPriority ? 'priority' : 'due date'}
            </Text>
          </SemGhostButton>
        </View>
        <View style={{ height: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 30 }} contentContainerStyle={{ alignItems: 'center' }}>
          {filterChip(null, 'All subjects')}
          {subjects.map((s) => filterChip(s.id, s.name, s.color))}
        </ScrollView>
      </View>
      <View style={{ height: 14 }} />
      {sorted.length === 0 ? (
        <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1 }} showsHorizontalScrollIndicator={false}>
          <EmptyState
            icon="inbox"
            title={status === 'done' ? 'Nothing completed yet' : 'No tasks here'}
            hint={
              status === 'done'
                ? 'Finished tasks will collect here.'
                : 'Add a task with a due date, priority and subject — it will also show up on the calendar.'
            }
            action={
              <SemPrimaryButton onPress={() => setCreating(true)}>
                <Icon name="add" size={16} color={c.paper} />
                <View style={{ width: 6 }} />
                <Text style={[t.bodyMedium, { color: c.paper, fontWeight: '500' }]}>New task</Text>
              </SemPrimaryButton>
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => <TodoCard todo={item} />}
        />
      )}

      {/* create sheet — auto-saving, like every Semester form */}
      <SemSheet visible={creating} title="New task" onClose={() => setCreating(false)}>
        <TodoFormSheet onDone={() => setCreating(false)} />
      </SemSheet>
    </View>
  );
}

/* ---------------- cards + form ---------------- */

function TodoCard({ todo }: { todo: Todo }) {
  const subjects = useSubjectsStore((s) => s.subjects);
  const [editing, setEditing] = useState(false);
  const { c, t } = useSem();
  const subject = findSubject(subjects, todo.subjectId);

  return (
    <>
      <View
        style={{
          marginBottom: 10,
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        <RoundCheck done={todo.done} onTap={() => useTodosStore.getState().toggleTodo(todo.id)} />
        <View style={{ width: 10 }} />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              t.bodyMedium,
              {
                fontWeight: '500',
                textDecorationLine: todo.done ? 'line-through' : 'none',
                color: todo.done ? c.inkSoft : c.ink,
              },
            ]}
          >
            {todo.title}
          </Text>
          <View style={{ height: 6 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {subject ? <SubjectTag name={subject.name} color={subject.color} /> : null}
            <DueChip due={todo.due} done={todo.done} />
            <PriorityBadge priority={todo.priority} />
          </View>
          {todo.notes ? (
            <>
              <View style={{ height: 6 }} />
              <Text numberOfLines={2} style={[t.bodySmall, { color: c.inkSoft }]}>
                {todo.notes}
              </Text>
            </>
          ) : null}
        </View>
        <View style={{ width: 6 }} />
        <SemIconButton icon="edit" size={16} onPress={() => setEditing(true)} />
        <SemIconButton icon="delete" size={16} onPress={() => useTodosStore.getState().removeTodo(todo.id)} />
      </View>
      <SemSheet visible={editing} title="Edit task" onClose={() => setEditing(false)}>
        <TodoFormSheet todo={todo} onDone={() => setEditing(false)} />
      </SemSheet>
    </>
  );
}

/* Port of TodoFormModal.tsx — shared shape with the homework sheet. */
export function TodoFormSheet({ todo, onDone }: { todo?: Todo; onDone: () => void }) {
  const [title, setTitle] = useState(todo?.title ?? '');
  const [notes, setNotes] = useState(todo?.notes ?? '');
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 'medium');
  const [due, setDue] = useState<string | null | undefined>(todo?.due);
  const [subjectId, setSubjectId] = useState<string | null | undefined>(todo?.subjectId);
  // auto-save: text edits commit debounced, discrete picks immediately —
  // the sheet can be dismissed at any moment without losing input
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const createdId = useRef<string | null>(null);
  const stateRef = useRef({ title, notes, priority, due, subjectId });
  stateRef.current = { title, notes, priority, due, subjectId };

  const targetId = todo?.id ?? createdId.current;

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
   * back to "Untitled" when content exists but no title was typed */
  function commit(relaxed: boolean) {
    const s = stateRef.current;
    const trimmedTitle = s.title.trim();
    const trimmedNotes = s.notes.trim();
    const isCreate = !todo && !createdId.current;
    const hasExtras = trimmedNotes !== '' || s.due != null || s.subjectId != null;
    const t2 = trimmedTitle === '' && relaxed && isCreate && hasExtras ? 'Untitled' : trimmedTitle;
    if (t2 === '') return;
    const store = useTodosStore.getState();
    const id = todo?.id ?? createdId.current;
    if (id) {
      const current = store.todos.find((x) => x.id === id);
      if (!current) return;
      store.updateTodo(id, {
        title: t2,
        notes: trimmedNotes === '' ? null : trimmedNotes,
        due: s.due ?? null,
        priority: s.priority,
        subjectId: s.subjectId ?? null,
      });
    } else {
      createdId.current = store.addTodo({
        title: t2,
        notes: trimmedNotes === '' ? undefined : trimmedNotes,
        due: s.due ?? undefined,
        priority: s.priority,
        subjectId: s.subjectId ?? undefined,
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

  return (
    <View>
      <SemLabel text="Title" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={title}
        autoFocus={!todo}
        placeholder="e.g. Linear algebra problem set 4"
        onChangeText={(v) => {
          setTitle(v);
          commitSoon();
        }}
      />
      <View style={{ height: 14 }} />
      <SemLabel text="Due (optional)" />
      <View style={{ height: 6 }} />
      <Pressable
        onPress={async () => {
          const picked = await pickDueDateTime(due ?? null);
          if (picked) {
            setDue(picked);
            commitNow();
          }
        }}
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
        <Icon name="schedule" size={15} color={c.inkSoft} />
        <View style={{ width: 8 }} />
        <Text style={[t.labelMedium, { fontSize: 13, color: due ? c.ink : c.inkSoft, flex: 1 }]}>
          {due == null ? 'Pick a date & time' : dueLabel(due)}
        </Text>
        {due != null ? (
          <SemIconButton
            icon="close"
            size={14}
            onPress={() => {
              setDue(null);
              commitNow();
            }}
          />
        ) : null}
      </Pressable>
      <View style={{ height: 14 }} />
      <SemLabel text="Priority" />
      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['low', 'medium', 'high'] as Priority[]).map((p) => (
          <View key={p} style={{ flex: 1 }}>
            <PriorityButton
              label={PRIORITY_LABEL[p]}
              selected={priority === p}
              onSelect={() => {
                setPriority(p);
                commitNow();
              }}
            />
          </View>
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
        numberOfLines={2}
        placeholder="Chapters, page numbers, links…"
        onChangeText={(v) => {
          setNotes(v);
          commitSoon();
        }}
      />
      <View style={{ height: 18 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[t.labelSmall, { color: c.inkSoft, flex: 1 }]}>Saves automatically</Text>
        <SemPrimaryButton onPress={flushAndClose}>Done</SemPrimaryButton>
      </View>
    </View>
  );
}

function PriorityButton({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { c, t } = useSem();
  return (
    <Pressable
      onPress={onSelect}
      style={{
        paddingVertical: 9,
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        backgroundColor: selected ? c.ink : c.card,
        borderColor: selected ? c.ink : c.line,
      }}
    >
      <Text style={[t.bodySmall, { fontWeight: '500', color: selected ? c.paper : c.inkSoft }]}>
        {label}
      </Text>
    </Pressable>
  );
}
