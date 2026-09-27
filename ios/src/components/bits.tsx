/* Port of `lib/widgets/bits.dart` — chips, dots, badges and the empty state
 * (the web app's bits.tsx + the .chip/.card component classes). */

import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { StyleProp } from 'react-native';

import { Priority, Tone } from '../models/types';
import { colorFromHex, toneColor, useSem } from '../theme/theme';
import { dueInfo, formatPoints, pointsToGrade } from '../utils/utils';
import { Icon } from './Icon';

export function SubjectDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorFromHex(color),
      }}
    />
  );
}

/** the pill chip — tone-tinted or neutral, mono or body text */
export function SemChip({
  leading,
  text,
  tone,
  mono = false,
  uppercase = false,
  style,
}: {
  leading?: React.ReactNode;
  text?: string;
  tone?: Tone;
  mono?: boolean;
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, t } = useSem();
  const border = tone == null ? c.line : `${toneColor(c, tone)}66`;
  const bg = tone == null ? c.paper : `${toneColor(c, tone)}1A`;
  const fg = tone == null ? c.ink : toneColor(c, tone);
  const base = mono ? t.labelMedium : { ...t.bodySmall, fontSize: 11 };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 3,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          borderRadius: 999,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {leading ? (
        <>
          {leading}
          <View style={{ width: 4 }} />
        </>
      ) : null}
      {text ? (
        <Text
          numberOfLines={1}
          style={[
            base,
            { color: fg },
            uppercase ? { letterSpacing: 0.8, fontWeight: '500' } : null,
          ]}
        >
          {uppercase ? text.toUpperCase() : text}
        </Text>
      ) : null}
    </View>
  );
}

export function SubjectTag({ name, color }: { name: string; color: string }) {
  return <SemChip leading={<SubjectDot color={color} />} text={name} />;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone: Tone = priority === 'high' ? 'bad' : priority === 'medium' ? 'warn' : 'neutral';
  const { c } = useSem();
  return (
    <SemChip
      tone={tone}
      mono
      uppercase
      text={priority}
      leading={<Icon name="flag" size={11} color={toneColor(c, tone)} />}
    />
  );
}

export function DueChip({ due, done = false }: { due?: string | null; done?: boolean }) {
  const info = dueInfo(due);
  if (!info) return null;
  const alarming = info.overdue && !done;
  const hot = !alarming && info.isToday && !done;
  const { c } = useSem();
  return (
    <SemChip
      mono
      tone={alarming ? 'bad' : hot ? 'warn' : undefined}
      text={alarming ? `Overdue — ${info.label}` : info.label}
      leading={
        alarming || hot ? (
          <Icon name="schedule" size={11} color={toneColor(c, alarming ? 'bad' : 'warn')} />
        ) : undefined
      }
    />
  );
}

/** German Punkte → classic +/− grade badge, e.g. "12 Pkt → 2+" */
export function GradeBadge({ points, big = false }: { points: number; big?: boolean }) {
  const tr = pointsToGrade(points);
  const { c, t } = useSem();
  const color = toneColor(c, tr.tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: big ? 12 : 8,
        paddingVertical: big ? 5 : 2,
        borderWidth: 1,
        borderColor: `${color}4D`,
        borderRadius: 999,
        backgroundColor: `${color}1A`,
        alignSelf: 'flex-start',
      }}
    >
      {big ? (
        <>
          <Text style={[t.labelMedium, { color, fontWeight: '400' }]}>{formatPoints(points)} →</Text>
          <View style={{ width: 5 }} />
        </>
      ) : null}
      <Text style={[t.labelMedium, { color, fontWeight: '600', fontSize: big ? 14 : 11 }]}>
        {tr.grade}
      </Text>
    </View>
  );
}

/* ---------------- empty state ---------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ComponentProps<typeof Icon>['name'];
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  const { c, t } = useSem();
  return (
    <View
      style={{
        width: '100%',
        paddingHorizontal: 24,
        paddingVertical: 44,
        backgroundColor: `${c.card}99`,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.line,
        alignItems: 'center',
      }}
    >
      {icon ? (
        <>
          <Icon name={icon} size={32} color={c.inkSoft} />
          <View style={{ height: 12 }} />
        </>
      ) : null}
      <Text style={[t.titleLarge, { textAlign: 'center' }]}>{title}</Text>
      {hint ? (
        <>
          <View style={{ height: 4 }} />
          <Text style={[t.bodyMedium, { textAlign: 'center', maxWidth: 380 }]}>{hint}</Text>
        </>
      ) : null}
      {action ? (
        <>
          <View style={{ height: 16 }} />
          {action}
        </>
      ) : null}
    </View>
  );
}
