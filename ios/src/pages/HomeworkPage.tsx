/* Port of homework/page.tsx + HomeworkFormModal.tsx — mirrors the tasks page
 * with its own open/done filter and the auto-saving form sheet. */

import React, { useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';

import { Homework, Priority } from '../models/types';
import { useHomeworkStore } from '../stores/homework_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { DueChip, EmptyState, PriorityBadge, SubjectDot, SubjectTag } from '../components/bits';
import { PageHeader, SegToggle, SemIconButton, SemLabel, SemPrimaryButton, SemSheet, SemTextField } from '../components/controls';
import { RoundCheck, SubjectSelect } from '../components/SubjectSelect';
import { Pressable } from '../components/motion';
import { dueLabel, pickDueDateTime } from '../components/pickers';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import { PRIORITY_LABEL, PRIORITY_ORDER, dueInfo, findSubject } from '../utils/utils';

type StatusFilter = 'open' | 'done' | 'all';

export function HomeworkPage(): React.JSX.Element {
  const homeworks = useHomeworkStore((s) => s.homeworks);
  const subjects = useSubjectsStore((s) => s.subjects);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { c, t } = useSem();

  let list = homeworks;
  if (status !== 'all') list = list.filter((x) => (status === 'done' ? x.done : !x.done));
  if (subjectFilter) list = list.filter((x) => x.subjectId === subjectFilter);
  const sorted = [...list].sort((a, b) => {
    const da = dueInfo(a.due)?.date.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = dueInfo(b.due)?.date.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return b.createdAt - a.createdAt;
  });

  const openCount = homeworks.filter((x) => !x.done).length;

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
          title="Homework"
          subtitle={`${openCount} open · ${homeworks.length - openCount} done`}
          trailing={
            <SemIconButton icon="add" color={c.ink} onPress={() => setCreating(true)} />
          }
        />
        <SegToggle<StatusFilter>
          options={[
            ['open', 'open'],
            ['done', 'done'],
            ['all', 'all'],
          ]}
          selected={status}
          onChanged={setStatus}
        />
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
            icon="menu_book"
            title={status === 'done' ? 'Nothing completed yet' : 'No homework here'}
            hint={
              status === 'done'
                ? 'Finished homework will collect here.'
                : 'Add what your teachers assigned — with a due date and subject, it shows up on the calendar too.'
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90 }}
          renderItem={({ item }) => <HomeworkCard homework={item} />}
        />
      )}

      {/* create sheet — auto-saving, like every Semester form */}
      <SemSheet visible={creating} title="New homework" onClose={() => setCreating(false)}>
        <HomeworkFormSheet onDone={() => setCreating(false)} />
      </SemSheet>
    </View>
  );
}

function HomeworkCard({ homework }: { homework: Homework }) {
  const subjects = useSubjectsStore((s) => s.subjects);
  const [editing, setEditing] = useState(false);
  const { c, t } = useSem();
  const subject = findSubject(subjects, homework.subjectId);

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
        <RoundCheck done={homework.done} onTap={() => useHomeworkStore.getState().toggleHomework(homework.id)} />
        <View style={{ width: 10 }} />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              t.bodyMedium,
              {
                fontWeight: '500',
                textDecorationLine: homework.done ? 'line-through' : 'none',
                color: homework.done ? c.inkSoft : c.ink,
              },
            ]}
          >
            {homework.title}
          </Text>
          <View style={{ height: 6 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {subject ? <SubjectTag name={subject.name} color={subject.color} /> : null}
            <DueChip due={homework.due} done={homework.done} />
            <PriorityBadge priority={homework.priority} />
          </View>
          {homework.notes ? (
            <>
              <View style={{ height: 6 }} />
              <Text numberOfLines={2} style={[t.bodySmall, { color: c.inkSoft }]}>
                {homework.notes}
              </Text>
            </>
          ) : null}
        </View>
        <View style={{ width: 6 }} />
        <SemIconButton icon="edit" size={16} onPress={() => setEditing(true)} />
        <SemIconButton
          icon="delete"
          size={16}
          onPress={() => useHomeworkStore.getState().removeHomework(homework.id)}
        />
      </View>
      <SemSheet visible={editing} title="Edit homework" onClose={() => setEditing(false)}>
        <HomeworkFormSheet homework={homework} onDone={() => setEditing(false)} />
      </SemSheet>
    </>
  );
}

/* Port of HomeworkFormModal.tsx. */
export function HomeworkFormSheet({
  homework,
  onDone,
}: {
  homework?: Homework;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(homework?.title ?? '');
  const [notes, setNotes] = useState(homework?.notes ?? '');
  const [priority, setPriority] = useState<Priority>(homework?.priority ?? 'medium');
  const [due, setDue] = useState<string | null | undefined>(homework?.due);
  const [subjectId, setSubjectId] = useState<string | null | undefined>(homework?.subjectId);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const createdId = useRef<string | null>(null);
  const stateRef = useRef({ title, notes, priority, due, subjectId });
  stateRef.current = { title, notes, priority, due, subjectId };

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

  function commit(relaxed: boolean) {
    const s = stateRef.current;
    const trimmedTitle = s.title.trim();
    const trimmedNotes = s.notes.trim();
    const isCreate = !homework && !createdId.current;
    const hasExtras = trimmedNotes !== '' || s.due != null || s.subjectId != null;
    const t2 = trimmedTitle === '' && relaxed && isCreate && hasExtras ? 'Untitled' : trimmedTitle;
    if (t2 === '') return;
    const store = useHomeworkStore.getState();
    const id = homework?.id ?? createdId.current;
    if (id) {
      const current = store.homeworks.find((x) => x.id === id);
      if (!current) return;
      store.updateHomework(id, {
        title: t2,
        notes: trimmedNotes === '' ? null : trimmedNotes,
        due: s.due ?? null,
        priority: s.priority,
        subjectId: s.subjectId ?? null,
      });
    } else {
      createdId.current = store.addHomework({
        title: t2,
        subjectId: s.subjectId ?? undefined,
        due: s.due ?? undefined,
        priority: s.priority,
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

  return (
    <View>
      <SemLabel text="Title" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={title}
        autoFocus={!homework}
        placeholder="e.g. Worksheet: quadratic equations"
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
            <Pressable
              onPress={() => {
                setPriority(p);
                commitNow();
              }}
              style={{
                paddingVertical: 9,
                alignItems: 'center',
                borderRadius: 10,
                borderWidth: 1,
                backgroundColor: priority === p ? c.ink : c.card,
                borderColor: priority === p ? c.ink : c.line,
              }}
            >
              <Text
                style={[
                  t.bodySmall,
                  { fontWeight: '500', color: priority === p ? c.paper : c.inkSoft },
                ]}
              >
                {PRIORITY_LABEL[p]}
              </Text>
            </Pressable>
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
        placeholder="Page numbers, exercises, links…"
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
