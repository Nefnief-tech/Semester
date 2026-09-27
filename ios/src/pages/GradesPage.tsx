/* Port of grades/page.tsx + SubjectCard + GradeFormModal + SubjectFormModal
 * + PointsTable — the Punkte (0–15) system with weighted averages. */

import React, { useEffect, useRef, useState } from 'react';
import { Pressable as RNPressable, ScrollView, Text, View } from 'react-native';

import { GradeEntry, Subject } from '../models/types';
import { useGradesStore } from '../stores/grades_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { EmptyState, GradeBadge, SemChip, SubjectDot } from '../components/bits';
import { PageHeader, SemCard, SemGhostButton, SemIconButton, SemLabel, SemPrimaryButton, SemSheet, SemTextField, confirmDialog } from '../components/controls';
import { Pressable } from '../components/motion';
import { usePaneWidth } from '../components/pane';
import { pickDate } from '../components/pickers';
import { Icon } from '../components/Icon';
import { toneColor, useSem } from '../theme/theme';
import { PALETTE, POINTS_TABLE, formatPoints, pointsToGrade, weightedAverage, weightSum } from '../utils/utils';

export function GradesPage(): React.JSX.Element {
  const subjects = useSubjectsStore((s) => s.subjects);
  const entries = useGradesStore((s) => s.entries);
  const { c, t } = useSem();
  const width = usePaneWidth();
  const regular = width >= 768;
  const horizontalPadding = regular ? 40 : 16;

  const [subjectForm, setSubjectForm] = useState<{ subject?: Subject } | null>(null);
  const [gradeForm, setGradeForm] = useState<{ subjectId?: string; entry?: GradeEntry } | null>(null);

  const overall = weightedAverage(entries);
  const bySubject = new Map<string, GradeEntry[]>();
  for (const e of entries) {
    const key = e.subjectId ?? '';
    const list = bySubject.get(key) ?? [];
    list.push(e);
    bySubject.set(key, list);
  }
  for (const list of bySubject.values()) {
    list.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: 8, paddingBottom: 40 }}>
      <Text style={[t.labelMedium, { fontSize: 12 }]}>Punkte system (0–15) · weighted averages</Text>
      <View style={{ height: 8 }} />

      {/* overall */}
      <SemCard padding={{ x: 20, y: 18 }}>
        <SemLabel text="overall average" />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[t.displayLarge, { fontSize: 44 }]}>
            {overall == null ? '—' : formatPoints(overall)}
          </Text>
          {overall != null ? (
            <>
              <View style={{ width: 6 }} />
              <Text style={{ color: c.inkSoft, fontSize: 14 }}>Pkt.</Text>
              <View style={{ width: 14 }} />
              <GradeBadge points={overall} big />
            </>
          ) : null}
        </View>
        <View style={{ height: 6 }} />
        <Text style={t.labelSmall}>
          across {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'} · {entries.length} graded{' '}
          {entries.length === 1 ? 'item' : 'items'}
        </Text>
      </SemCard>
      <View style={{ height: 16 }} />

      {/* points table */}
      <PointsTableCard />
      <View style={{ height: 16 }} />

      {subjects.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="No subjects yet"
          hint="Subjects are shared across tasks, grades and the calendar. Create one to start tracking grades."
          action={
            <SemPrimaryButton onPress={() => setSubjectForm({})}>
              <Icon name="add" size={16} color={c.paper} />
              <View style={{ width: 6 }} />
              <Text style={[t.bodyMedium, { color: c.paper, fontWeight: '500' }]}>New subject</Text>
            </SemPrimaryButton>
          }
        />
      ) : (
        <View style={regular ? { flexDirection: 'row', flexWrap: 'wrap', gap: 18 } : undefined}>
          {subjects.map((s) => (
            <View key={s.id} style={regular ? { width: '47%', flexGrow: 1 } : undefined}>
              <SubjectCard
                subject={s}
                entries={bySubject.get(s.id) ?? []}
                onEditSubject={() => setSubjectForm({ subject: s })}
                onAddGrade={() => setGradeForm({ subjectId: s.id })}
                onEditGrade={(entry) => setGradeForm({ entry })}
              />
            </View>
          ))}
        </View>
      )}

      <SemSheet
        visible={subjectForm != null}
        title={subjectForm?.subject ? 'Edit subject' : 'New subject'}
        onClose={() => setSubjectForm(null)}
      >
        {subjectForm ? <SubjectFormSheet subject={subjectForm.subject} onDone={() => setSubjectForm(null)} /> : null}
      </SemSheet>
      <SemSheet
        visible={gradeForm != null}
        title={gradeForm?.entry ? 'Edit grade' : 'Add grade'}
        onClose={() => setGradeForm(null)}
      >
        {gradeForm ? (
          <GradeFormSheet subjectId={gradeForm.subjectId} entry={gradeForm.entry} onDone={() => setGradeForm(null)} />
        ) : null}
      </SemSheet>
    </ScrollView>
  );
}

/* ---------------- Punkte → Noten table ---------------- */

function PointsTableCard(): React.JSX.Element {
  const { c, t } = useSem();
  const [open, setOpen] = useState(false);
  return (
    <SemCard>
      <Pressable onPress={() => setOpen(!open)} style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[t.titleMedium, { fontWeight: '600' }]}>Punkte → Noten</Text>
            <Text style={t.labelSmall}>0–15 translated to 6–1 with +/−</Text>
          </View>
          <Icon name={open ? 'expand_less' : 'expand_more'} size={22} color={c.inkSoft} />
        </View>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {POINTS_TABLE.map((row) => (
              <View
                key={row.points}
                style={{
                  width: '23.2%',
                  flexGrow: 1,
                  paddingVertical: 6,
                  backgroundColor: c.paper,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={[t.labelLarge, { fontSize: 13, color: c.ink, fontWeight: '600' }]}>{row.points}</Text>
                <Text style={{ fontSize: 11, color: c.accent }}>{row.grade}</Text>
                <Text numberOfLines={1} style={{ fontSize: 9, color: c.inkSoft }}>
                  {row.note}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ height: 10 }} />
          <Text style={[t.labelSmall, { lineHeight: 16 }]}>
            every whole grade spans 3 points: 3 · 2 · 1 = 5+ · 5 · 5− — 4 points (4−) still passes, 3 points (5+) does
            not.
          </Text>
        </View>
      ) : null}
    </SemCard>
  );
}

/* ---------------- subject card ---------------- */

function SubjectCard({
  subject,
  entries,
  onEditSubject,
  onAddGrade,
  onEditGrade,
}: {
  subject: Subject;
  entries: GradeEntry[];
  onEditSubject: () => void;
  onAddGrade: () => void;
  onEditGrade: (entry: GradeEntry) => void;
}) {
  const { c, t } = useSem();
  const avg = weightedAverage(entries);
  const wSum = weightSum(entries);
  const weightWarning = entries.length > 0 && wSum !== 100;

  return (
    <View style={{ marginBottom: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingTop: 14, paddingBottom: 12 }}>
        <SubjectDot color={subject.color} size={12} />
        <View style={{ width: 10 }} />
        <Text numberOfLines={1} style={[t.headlineSmall, { flex: 1 }]}>
          {subject.name}
        </Text>
        <SemIconButton icon="edit" size={15} onPress={onEditSubject} />
        <SemIconButton
          icon="delete"
          size={15}
          onPress={async () => {
            const ok = await confirmDialog(
              `Delete “${subject.name}”?${
                entries.length > 0 ? ` This also removes its ${entries.length} grade${entries.length === 1 ? '' : 's'}.` : ''
              }`,
              { title: 'Delete subject' },
            );
            if (ok) useSubjectsStore.getState().removeSubject(subject.id);
          }}
        />
      </View>
      {/* average */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <SemLabel text="Schnitt" />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[t.displayMedium, { fontSize: 34 }]}>{avg == null ? '—' : formatPoints(avg)}</Text>
          {avg != null ? (
            <>
              <View style={{ width: 5 }} />
              <Text style={{ color: c.inkSoft, fontSize: 12 }}>Pkt.</Text>
              <View style={{ width: 12 }} />
              <GradeBadge points={avg} big />
            </>
          ) : null}
        </View>
        <View style={{ height: 4 }} />
        <Text style={[t.labelSmall, { fontSize: 11 }]}>
          {entries.length} {entries.length === 1 ? 'grade' : 'grades'} · Σ weight{' '}
          <Text style={{ color: weightWarning ? c.amber : c.inkSoft }}>{wSum}</Text>
          {weightWarning ? <Text style={{ color: c.inkSoft }}> (relative)</Text> : null}
        </Text>
      </View>
      {/* entries */}
      {entries.length > 0 ? (
        <View style={{ borderTopWidth: 1, borderColor: c.line }}>
          {entries.map((e) => {
            const tr = pointsToGrade(e.points);
            return (
              <Pressable key={e.id} onPress={() => onEditGrade(e)}>
                <View
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderColor: `${c.line}99`,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text numberOfLines={1} style={[t.bodyMedium, { flex: 1 }]}>
                    {e.title}
                    {e.date ? <Text style={t.labelSmall}>  {e.date.slice(5)}</Text> : null}
                  </Text>
                  <Text style={t.labelSmall}>{e.points} Pkt</Text>
                  <View style={{ width: 10 }} />
                  <SemChip mono text={`×${e.weight}`} />
                  <View style={{ width: 10 }} />
                  <Text style={[t.labelMedium, { fontSize: 12, fontWeight: '600', color: toneColor(c, tr.tone) }]}>
                    {tr.grade}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {/* add grade */}
      <View style={{ padding: 12 }}>
        <SemGhostButton onPress={onAddGrade}>
          <Icon name="add" size={16} />
          <View style={{ width: 6 }} />
          <Text style={t.bodyMedium}>Add grade</Text>
        </SemGhostButton>
      </View>
    </View>
  );
}

/* ---------------- subject form (auto-save) ---------------- */

function SubjectFormSheet({ subject, onDone }: { subject?: Subject; onDone: () => void }) {
  const [name, setName] = useState(subject?.name ?? '');
  const initialColor = subject?.color ?? PALETTE[Math.floor(Date.now() / 1000) % PALETTE.length];
  const [color, setColor] = useState(initialColor);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const createdId = useRef<string | null>(null);
  const stateRef = useRef({ name, color, initialColor });
  stateRef.current = { name, color, initialColor };

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
    const trimmed = s.name.trim();
    const isCreate = !subject && !createdId.current;
    const hasContent = trimmed !== '' || s.color !== s.initialColor;
    const n = trimmed === '' && relaxed && isCreate && hasContent ? 'Untitled' : trimmed;
    if (n === '') return;
    const store = useSubjectsStore.getState();
    const id = subject?.id ?? createdId.current;
    if (id) {
      store.updateSubject(id, { name: n, color: s.color });
    } else {
      createdId.current = store.addSubject(n, s.color).id;
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
  const noSubjects = useSubjectsStore((s) => s.subjects.length === 0);

  return (
    <View>
      <SemLabel text="Name" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={name}
        autoFocus={!subject}
        placeholder="e.g. Mathematics"
        onChangeText={(v) => {
          setName(v);
          commitSoon();
        }}
      />
      <View style={{ height: 14 }} />
      <SemLabel text="Color" />
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PALETTE.map((p) => (
          <Pressable
            key={p}
            onPress={() => {
              setColor(p);
              commitNow();
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: p,
              borderWidth: 2,
              borderColor: color === p ? c.ink : 'transparent',
            }}
          >
            <View />
          </Pressable>
        ))}
      </View>
      {!subject && noSubjects ? (
        <>
          <View style={{ height: 8 }} />
          <Text style={{ color: c.marker, fontSize: 13 }}>Create a subject first.</Text>
        </>
      ) : null}
      <View style={{ height: 18 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[t.labelSmall, { color: c.inkSoft, flex: 1 }]}>Saves automatically</Text>
        <SemPrimaryButton onPress={flushAndClose}>Done</SemPrimaryButton>
      </View>
    </View>
  );
}

/* ---------------- grade form (auto-save) ---------------- */

function GradeFormSheet({
  subjectId,
  entry,
  onDone,
}: {
  subjectId?: string;
  entry?: GradeEntry;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [points, setPoints] = useState(entry != null ? `${entry.points}` : '');
  const [weight, setWeight] = useState(entry != null ? `${entry.weight}` : '20');
  const [date, setDate] = useState<string | null | undefined>(entry?.date);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const createdId = useRef<string | null>(null);
  const stateRef = useRef({ title, points, weight, date });
  stateRef.current = { title, points, weight, date };

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (dirty.current) commit();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function commitSoon() {
    dirty.current = true;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => commit(), 400);
  }

  function commitNow() {
    dirty.current = true;
    if (debounce.current) clearTimeout(debounce.current);
    // deferred one tick: the setState call before this re-renders and only
    // then updates stateRef — a synchronous read would see the old value
    setTimeout(() => commit(), 0);
  }

  /** writes the form into the store once title + points + weight are all valid */
  function commit() {
    const s = stateRef.current;
    const trimmedTitle = s.title.trim();
    const p = Number(s.points.replace(',', '.'));
    const w = Number(s.weight.replace(',', '.'));
    if (!trimmedTitle || Number.isNaN(p) || p < 0 || p > 15 || Number.isNaN(w) || w <= 0) return;
    const store = useGradesStore.getState();
    const id = entry?.id ?? createdId.current;
    if (id) {
      const current = store.entries.find((x) => x.id === id);
      if (!current) return;
      store.updateEntry(id, { title: trimmedTitle, points: p, weight: w, date: s.date ?? undefined });
    } else {
      const subject = subjectId ?? useSubjectsStore.getState().subjects[0]?.id ?? '';
      if (!subject) return;
      createdId.current = store.addEntry({
        subjectId: subject,
        title: trimmedTitle,
        points: p,
        weight: w,
        date: s.date ?? undefined,
      });
    }
  }

  function flushAndClose() {
    if (debounce.current) clearTimeout(debounce.current);
    if (dirty.current) {
      dirty.current = false;
      commit();
    }
    onDone();
  }

  const { c, t } = useSem();
  const noSubjects = useSubjectsStore((s) => s.subjects.length === 0);
  const p = Number(points.replace(',', '.'));
  const preview = Number.isFinite(p) && p >= 0 && p <= 15 ? pointsToGrade(p) : null;

  return (
    <View>
      <SemLabel text="Title" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={title}
        autoFocus={!entry}
        placeholder="e.g. Test, Abfrage, Essay"
        onChangeText={(v) => {
          setTitle(v);
          commitSoon();
        }}
      />
      <View style={{ height: 14 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SemLabel text="Punkte (0–15)" />
          <View style={{ height: 6 }} />
          <SemTextField
            value={points}
            keyboardType="number-pad"
            placeholder="0–15"
            onChangeText={(v) => {
              setPoints(v);
              commitSoon();
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SemLabel text="Weight" />
          <View style={{ height: 6 }} />
          <SemTextField
            value={weight}
            keyboardType="numbers-and-punctuation"
            placeholder="20"
            onChangeText={(v) => {
              setWeight(v);
              commitSoon();
            }}
          />
        </View>
      </View>
      {preview ? (
        <>
          <View style={{ height: 6 }} />
          <Text style={[t.labelSmall, { fontSize: 11 }]}>
            ={' '}
            <Text style={{ color: toneColor(c, preview.tone), fontWeight: '600' }}>{preview.grade}</Text>
            {` (${preview.note})`}
          </Text>
        </>
      ) : null}
      <View style={{ height: 14 }} />
      <SemLabel text="Date (optional)" />
      <View style={{ height: 6 }} />
      <Pressable
        onPress={async () => {
          const picked = await pickDate(date ?? null);
          if (picked !== date) {
            setDate(picked);
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
        <Icon name="calendar_today" size={14} color={c.inkSoft} />
        <View style={{ width: 8 }} />
        <Text style={[t.labelMedium, { fontSize: 13, color: date ? c.ink : c.inkSoft, flex: 1 }]}>
          {date ?? '—'}
        </Text>
        {date ? (
          <SemIconButton
            icon="close"
            size={14}
            onPress={() => {
              setDate(null);
              commitNow();
            }}
          />
        ) : null}
      </Pressable>
      <View style={{ height: 14 }} />
      <SemLabel text="Quick pick" />
      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {Array.from({ length: 16 }, (_, i) => 15 - i).map((i) => (
          <RNPressable
            key={i}
            onPress={() => {
              setPoints(`${i}`);
              commitNow();
            }}
            style={{
              width: 38,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              borderWidth: 1,
              backgroundColor: points === `${i}` ? c.ink : c.card,
              borderColor: points === `${i}` ? c.ink : c.line,
            }}
          >
            <Text style={[t.labelMedium, { fontSize: 12, color: points === `${i}` ? c.paper : c.inkSoft }]}>
              {i}
            </Text>
          </RNPressable>
        ))}
      </View>
      {!entry && noSubjects ? (
        <>
          <View style={{ height: 8 }} />
          <Text style={{ color: c.marker, fontSize: 13 }}>Create a subject first.</Text>
        </>
      ) : null}
      <View style={{ height: 18 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {entry ? (
          <SemGhostButton
            foreground={c.marker}
            border={`${c.marker}66`}
            onPress={() => {
              if (debounce.current) clearTimeout(debounce.current);
              dirty.current = false;
              useGradesStore.getState().removeEntry(entry.id);
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
