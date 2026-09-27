/* Port of timetable/page.tsx — weekly grid + Eltern-portal substitute plan.
 * On iPad the day columns stretch to the full width (no horizontal
 * scrolling); phones keep the Flutter behavior of a horizontally scrolling
 * grid with 92pt columns. */

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PortalDay, PortalSub } from '../models/types';
import { reconcilePortalSnapshot } from '../lib/sync';
import { ApiError, SemesterApi } from '../lib/api';
import { usePortalStore } from '../stores/portal_store';
import { useSubjectsStore } from '../stores/subjects_store';
import { useTimetableStore } from '../stores/timetable_store';
import { EmptyState, SemChip, SubjectDot } from '../components/bits';
import { PageHeader, SemCard, SemGhostButton, SemLabel, SemPrimaryButton, SemSheet, SemTextField, confirmDialog } from '../components/controls';
import { Pressable } from '../components/motion';
import { usePaneWidth } from '../components/pane';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import {
  DAY_ORDER,
  EXAMPLE_TIMETABLE,
  ParseResult,
  parseTimetable,
  timetableToJson,
} from '../utils/timetable';
import { PALETTE, formatClock } from '../utils/utils';

const PORTAL_WEEKDAY: Record<string, string> = {
  mo: 'Mon',
  di: 'Tue',
  mi: 'Wed',
  do: 'Thu',
  fr: 'Fri',
  sa: 'Sat',
  so: 'Sun',
};

/** periods a plan row covers: "3" → [3], "3 - 4" → [3, 4] (double lessons) */
function subPeriods(period: string): number[] {
  const range = period.match(/(\d+)\s*[-–/]\s*(\d+)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      const out: number[] = [];
      for (let i = a; i <= b && i - a < 12; i++) out.push(i);
      return out;
    }
  }
  const p = parseInt(period, 10);
  return Number.isNaN(p) ? [] : [p];
}

function subjectColor(name: string, colorsByName: Record<string, string>): string {
  return colorsByName[name.toLowerCase()] ?? PALETTE[name.length % PALETTE.length];
}

export function TimetablePage(): React.JSX.Element {
  const entries = useTimetableStore((s) => s.entries);
  const portal = usePortalStore();
  const subjects = useSubjectsStore((s) => s.subjects);
  const { c, t } = useSem();
  const width = usePaneWidth();
  const regular = width >= 768;
  const horizontalPadding = regular ? 40 : 16;
  const [jsonSheet, setJsonSheet] = useState(false);
  const fetchedOnce = useRef(false);

  // auto-fetch on first build when enabled and credentials are stored
  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    const p = usePortalStore.getState();
    if (p.autoFetch && p.baseUrl && p.username && p.password) {
      void doPortalFetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorsByName: Record<string, string> = {};
  for (const s of subjects) colorsByName[s.name.toLowerCase()] = s.color;

  const days = DAY_ORDER.filter((d) => entries.some((e) => e.day === d));
  const periods = [...new Set(entries.map((e) => e.period))].sort((a, b) => a - b);
  const periodTime: Record<number, string> = {};
  for (const e of entries) if (e.time && !(e.period in periodTime)) periodTime[e.period] = e.time;
  const now = new Date();
  const todayCol = DAY_ORDER[now.getDay() === 0 ? 6 : now.getDay() - 1];

  // substitute-plan entries that affect the grid — the student's own courses
  // when the membership list was scraped, otherwise all rows
  const relevantSubs: PortalSub[] = (() => {
    if (!portal.data) return [];
    const all = portalAllEntries(portal.data);
    const own = portal.data.courses.map((x) => x.trim()).filter((x) => x);
    return own.length === 0 ? all : all.filter((s) => own.includes(s.course.trim()));
  })();

  const gridWidth = 76 + days.length * 92;
  const available = width - horizontalPadding * 2 - 2;
  const columnWidth = regular && days.length > 0 ? Math.max(92, Math.floor((available - 76) / days.length)) : 92;
  const needsScroll = gridWidth > available;

  const cellSubsFor = (subs: PortalSub[], day: string, period: number): PortalSub[] =>
    subs.filter((s) => PORTAL_WEEKDAY[s.weekday.toLowerCase()] === day && subPeriods(s.period).includes(period));

  const cellContent = (day: string, period: number) => {
    const items = entries.filter((e) => e.day === day && e.period === period);
    const cellSubs = cellSubsFor(relevantSubs, day, period);
    if (items.length === 0 && cellSubs.length === 0) {
      return <Text style={{ color: `${c.inkSoft}66` }}>—</Text>;
    }
    return (
      <View>
        {items.map((e, i) => (
          <View key={`e${i}`} style={{ marginBottom: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SubjectDot color={subjectColor(e.subject, colorsByName)} size={9} />
              <View style={{ width: 5 }} />
              <Text numberOfLines={1} style={[t.bodySmall, { fontSize: 11, fontWeight: '600', flex: 1 }]}>
                {e.subject}
              </Text>
            </View>
            {e.time ? <Text style={[t.labelSmall, { fontSize: 8 }]}>{e.time}</Text> : null}
            {e.teacher ? <Text style={[t.labelSmall, { fontSize: 8 }]}>{e.teacher}</Text> : null}
            {e.room ? <Text style={[t.labelSmall, { fontSize: 8 }]}>room {e.room}</Text> : null}
          </View>
        ))}
        {cellSubs.map((s, i) => (
          <Text
            key={`s${i}`}
            style={[
              t.labelSmall,
              {
                fontSize: 8.5,
                marginBottom: 3,
                color: s.cancelled
                  ? c.marker
                  : c.amber,
              },
            ]}
          >
            {s.cancelled
              ? `cancelled · ${s.date.slice(0, 6)}`
              : `→ ${s.substitute || '?'}${s.room ? ` · ${s.room}` : ''} · ${s.date.slice(0, 6)}`}
          </Text>
        ))}
      </View>
    );
  };

  const headCell = (child: React.ReactNode, opts: { highlight?: boolean; width?: number; flex?: boolean } = {}) => (
    <View
      style={[
        {
          width: opts.width,
          paddingHorizontal: 6,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 1,
          borderRightWidth: 1,
          borderColor: c.line,
          backgroundColor: opts.highlight ? c.accentSoft : c.card,
        },
        opts.flex ? { flex: 1 } : null,
      ]}
    >
      {child}
    </View>
  );

  const grid = (
    <View
      style={{
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 16,
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      <ScrollView horizontal={needsScroll} showsHorizontalScrollIndicator={false}>
        <View style={{ width: needsScroll ? gridWidth : undefined, alignSelf: 'stretch' }}>
          {/* header row */}
          <View style={{ flexDirection: 'row' }}>
            {headCell(
              <Text style={[t.labelSmall, { letterSpacing: 1.2 }]}>PD</Text>,
              { width: 76 },
            )}
            {days.map((d) => (
              <View key={d} style={{ flex: needsScroll ? undefined : 1, width: needsScroll ? columnWidth : undefined }}>
                {headCell(
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        t.titleMedium,
                        { fontWeight: '600', color: d === todayCol ? c.accent : c.ink },
                      ]}
                    >
                      {d}
                    </Text>
                    {d === todayCol ? (
                      <>
                        <View style={{ width: 6 }} />
                        <Text style={[t.labelSmall, { fontSize: 8, letterSpacing: 1 }]}>TODAY</Text>
                      </>
                    ) : null}
                  </View>,
                  { highlight: d === todayCol },
                )}
              </View>
            ))}
          </View>
          {/* body rows */}
          {periods.map((p) => (
            <View key={p} style={{ flexDirection: 'row', minHeight: 56 }}>
              {headCell(
                <View style={{ alignItems: 'center' }}>
                  <Text style={[t.labelLarge, { color: c.ink, fontWeight: '600' }]}>{p}</Text>
                  {periodTime[p] ? (
                    <Text style={[t.labelSmall, { fontSize: 8 }]}>{periodTime[p].split(' - ')[0]}</Text>
                  ) : null}
                </View>,
                { width: 76 },
              )}
              {days.map((d) => {
                const subs = cellSubsFor(relevantSubs, d, p);
                const cancelled = subs.some((s) => s.cancelled);
                const substituted = subs.some((s) => !s.cancelled);
                return (
                  <View
                    key={d}
                    style={{
                      flex: needsScroll ? undefined : 1,
                      width: needsScroll ? columnWidth : undefined,
                      padding: 6,
                      borderBottomWidth: 1,
                      borderRightWidth: 1,
                      borderColor: c.line,
                      backgroundColor: cancelled
                        ? `${c.marker}14`
                        : substituted
                          ? `${c.amber}12`
                          : d === todayCol
                            ? `${c.accent}0F`
                            : 'transparent',
                    }}
                  >
                    {cellContent(d, p)}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: 16, paddingBottom: 32 }}>
      <PageHeader
        title="Timetable"
        subtitle="paste your timetable as JSON — formatted automatically"
        trailing={
          entries.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <SemGhostButton onPress={() => setJsonSheet(true)}>
                <Icon name="upload" size={15} />
                <View style={{ width: 6 }} />
                <Text style={t.bodyMedium}>Edit JSON</Text>
              </SemGhostButton>
              <SemGhostButton
                foreground={c.marker}
                border={`${c.marker}66`}
                onPress={async () => {
                  const ok = await confirmDialog('Clear the whole timetable?', { title: 'Clear timetable' });
                  if (ok) useTimetableStore.getState().clear();
                }}
              >
                <Icon name="layers_clear" size={16} color={c.marker} />
              </SemGhostButton>
            </View>
          ) : null
        }
      />

      {/* portal settings + status */}
      <PortalCard relevantCount={relevantSubs.length} />

      <View style={{ height: 20 }} />

      {/* legend */}
      {relevantSubs.length > 0 || portal.error ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.marker }} />
              <View style={{ width: 5 }} />
              <Text style={t.labelSmall}>cancelled</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.amber }} />
              <View style={{ width: 5 }} />
              <Text style={t.labelSmall}>substituted</Text>
            </View>
            {relevantSubs.length > 0 ? (
              <Text style={t.labelSmall}>· {relevantSubs.length} for your courses</Text>
            ) : null}
          </View>
          <View style={{ height: 10 }} />
        </>
      ) : null}

      {/* grid */}
      {entries.length > 0 ? (
        grid
      ) : (
        <EmptyState
          icon="table_chart"
          title="No timetable yet"
          hint="Paste your school's timetable as JSON and it becomes a clean weekly grid. The example shows the exact format."
          action={
            <SemPrimaryButton onPress={() => setJsonSheet(true)}>
              <Icon name="upload" size={16} color={c.paper} />
              <View style={{ width: 6 }} />
              <Text style={[t.bodyMedium, { color: c.paper, fontWeight: '500' }]}>Paste JSON</Text>
            </SemPrimaryButton>
          }
        />
      )}

      {/* substitutions list */}
      {relevantSubs.length > 0 ? (
        <>
          <View style={{ height: 32 }} />
          <Text style={t.headlineSmall}>Substitutions</Text>
          <View style={{ height: 12 }} />
          {(portal.data?.days ?? []).map((day) => {
            const daySubs = relevantSubs.filter((s) => s.date === day.date);
            if (daySubs.length === 0) return null;
            return (
              <View
                key={day.date}
                style={{
                  marginBottom: 14,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 16,
                }}
              >
                <Text style={[t.labelSmall, { fontSize: 11 }]}>
                  {day.weekday}., {day.date}
                </Text>
                <View style={{ height: 8 }} />
                {daySubs.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <SemChip mono tone={s.cancelled ? 'bad' : 'warn'} text={`${s.period}.`} />
                    <View style={{ width: 8 }} />
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      {s.courseOld ? (
                        <Text style={[t.bodyMedium, { color: c.inkSoft, textDecorationLine: 'line-through' }]}>
                          {s.courseOld}
                        </Text>
                      ) : null}
                      <Text style={[t.bodyMedium, { fontWeight: '500' }]}>{s.course}</Text>
                      {!s.cancelled && s.substitute ? (
                        <Text style={{ color: c.inkSoft }}>→ {s.substitute}</Text>
                      ) : null}
                      {s.room ? <Text style={t.labelSmall}>room {s.room}</Text> : null}
                      {s.info ? (
                        <Text style={[t.bodySmall, { fontSize: 11, color: c.inkSoft }]}>{s.info}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </>
      ) : null}

      <SemSheet
        visible={jsonSheet}
        title={entries.length === 0 ? 'Paste timetable JSON' : 'Edit timetable JSON'}
        onClose={() => setJsonSheet(false)}
      >
        <JsonImportBody onLoaded={() => setJsonSheet(false)} />
      </SemSheet>
    </ScrollView>
  );
}

function portalAllEntries(plan: { days: PortalDay[] }): PortalSub[] {
  return plan.days.flatMap((d) => d.entries);
}

export async function doPortalFetch(): Promise<void> {
  const portal = usePortalStore.getState();
  portal.setError(null);
  try {
    const plan = await SemesterApi.fetchPortalPlan();
    portal.setData(plan);
    // best-effort: plan (no credentials) into the cloud for the daily digest.
    // The fetch is authoritative — retract rows from older fetches / the web
    // so the cloud never keeps two versions of the same slot alive.
    await reconcilePortalSnapshot();
  } catch (e) {
    portal.setError(
      e instanceof ApiError ? e.message : 'Could not reach the portal.',
    );
  }
}

/* ---------------- portal settings card ---------------- */

function PortalCard({ relevantCount }: { relevantCount: number }): React.JSX.Element {
  const portal = usePortalStore();
  const { c, t } = useSem();
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [fetching, setFetching] = useState(false);

  const hasSettings = portal.baseUrl && portal.username && portal.password;
  const open = openOverride ?? (!portal.data || !!portal.error);

  return (
    <SemCard>
      <Pressable
        onPress={() => setOpenOverride(!open)}
        style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[t.titleMedium, { fontWeight: '600' }]}>Substitute plan (Vertretungsplan)</Text>
          {portal.lastFetched != null && !portal.error ? (
            <Text style={t.labelSmall}>
              fetched {formatClock(portal.lastFetched)}
              {relevantCount > 0 ? ` · ${relevantCount} for your courses` : ''}
            </Text>
          ) : null}
        </View>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={22} color={c.inkSoft} />
      </Pressable>
      {open ? (
        <>
          <View style={{ height: 1, backgroundColor: c.line }} />
          <View style={{ padding: 20 }}>
            <SemLabel text="Portal URL" />
            <View style={{ height: 6 }} />
            <SemTextField
              defaultValue={portal.baseUrl}
              placeholder="https://evbg.eltern-portal.org"
              autoCapitalize="none"
              onChangeText={(v) => usePortalStore.getState().setSettings({ baseUrl: v })}
            />
            <View style={{ height: 12 }} />
            <SemLabel text="Portal email" />
            <View style={{ height: 6 }} />
            <SemTextField
              defaultValue={portal.username}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={(v) => usePortalStore.getState().setSettings({ username: v })}
            />
            <View style={{ height: 12 }} />
            <SemLabel text="Portal password" />
            <View style={{ height: 6 }} />
            <SemTextField
              defaultValue={portal.password}
              secureTextEntry
              autoCorrect={false}
              onChangeText={(v) => usePortalStore.getState().setSettings({ password: v })}
            />
            <View style={{ height: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => portal.setSettings({ autoFetch: !portal.autoFetch })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: portal.autoFetch ? c.accent : c.line,
                  backgroundColor: portal.autoFetch ? c.accent : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {portal.autoFetch ? (
                  <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 14, lineHeight: 14, color: '#F5F2EA' }}>
                    {'\ue668'}
                  </Text>
                ) : null}
              </Pressable>
              <Text style={[t.bodySmall, { flex: 1 }]}>fetch automatically on every visit</Text>
            </View>
            <View style={{ height: 14 }} />
            <View style={{ alignItems: 'flex-end' }}>
              <SemPrimaryButton
                disabled={fetching || !hasSettings}
                onPress={async () => {
                  setFetching(true);
                  await doPortalFetch();
                  setFetching(false);
                }}
              >
                {fetching ? (
                  <Text style={[t.bodyMedium, { color: '#F5F2EA' }]}>…</Text>
                ) : (
                  <>
                    <Icon name="refresh" size={16} color="#F5F2EA" />
                    <View style={{ width: 6 }} />
                    <Text style={[t.bodyMedium, { color: '#F5F2EA', fontWeight: '500' }]}>Fetch now</Text>
                  </>
                )}
              </SemPrimaryButton>
            </View>
            {portal.error ? (
              <>
                <View style={{ height: 10 }} />
                <Text style={{ color: c.marker, fontSize: 13 }}>{portal.error}</Text>
              </>
            ) : null}
            <View style={{ height: 10 }} />
            <Text style={[t.labelSmall, { lineHeight: 16 }]}>
              credentials are stored only on this device and sent only to your own server when fetching.
            </Text>
          </View>
        </>
      ) : null}
    </SemCard>
  );
}

/* ---------------- json import body ---------------- */

function JsonImportBody({ onLoaded }: { onLoaded: () => void }): React.JSX.Element {
  const entries = useTimetableStore((s) => s.entries);
  const { c, t } = useSem();
  const [text, setText] = useState(entries.length > 0 ? timetableToJson(entries) : '');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = (raw: string) => {
    try {
      const result: ParseResult = parseTimetable(raw);
      useTimetableStore.getState().setTimetable(result.entries);
      setWarnings(result.warnings);
      setError('');
      if (result.warnings.length === 0) onLoaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      setWarnings([]);
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Text style={[t.labelSmall, { flex: 1 }]}>
          each entry: day · period · subject — optional: time · teacher · room.
        </Text>
        <SemGhostButton onPress={() => setText(EXAMPLE_TIMETABLE)}>
          <Text style={[t.bodySmall, { fontSize: 12 }]}>Use example</Text>
        </SemGhostButton>
      </View>
      <View style={{ height: 10 }} />
      <SemTextField
        value={text}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder='[{ "day": "mon", "period": 1, "subject": "Mathematics", "room": "B102" }, …]'
        onChangeText={setText}
        style={{ minHeight: 160, fontFamily: 'IBM Plex Mono', fontSize: 11, textAlignVertical: 'top', lineHeight: 17 }}
      />
      <View style={{ height: 10 }} />
      {error ? <Text style={{ color: c.marker, fontSize: 13 }}>{error}</Text> : null}
      {warnings.map((w, i) => (
        <Text key={i} style={{ color: c.amber, fontSize: 11 }}>
          • {w}
        </Text>
      ))}
      <View style={{ height: 14 }} />
      <View style={{ alignItems: 'flex-end' }}>
        <SemPrimaryButton onPress={() => load(text)}>
          <Icon name="upload" size={16} color="#F5F2EA" />
          <View style={{ width: 6 }} />
          <Text style={[t.bodyMedium, { color: '#F5F2EA', fontWeight: '500' }]}>Format timetable</Text>
        </SemPrimaryButton>
      </View>
    </View>
  );
}
