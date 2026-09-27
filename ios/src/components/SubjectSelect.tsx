/* Port of SubjectSelect.tsx — subject picker with an inline "new subject"
 * flow, rendered as choice chips (mobile-friendlier than a dropdown). */

import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { useSubjectsStore } from '../stores/subjects_store';
import { useSem } from '../theme/theme';
import { SubjectDot } from './bits';
import { SemGhostButton, SemLabel, SemPrimaryButton, SemTextField } from './controls';
import { Pressable } from './motion';

export function SubjectSelect({
  value,
  onChanged,
}: {
  value?: string | null;
  onChanged: (id: string | null) => void;
}) {
  const { c, t } = useSem();
  const subjects = useSubjectsStore((s) => s.subjects);
  const addSubject = useSubjectsStore((s) => s.addSubject);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const subject = addSubject(trimmed);
    setName('');
    setCreating(false);
    onChanged(subject.id);
  };

  const pickChip = (
    selected: boolean,
    label: string,
    onTap: () => void,
    dotColor?: string,
    key?: string,
  ) => (
    <Pressable
      key={key ?? label}
      onPress={onTap}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? c.ink : c.line,
        backgroundColor: selected ? c.ink : c.paper,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {dotColor ? (
        <>
          <SubjectDot color={dotColor} size={8} />
          <View style={{ width: 5 }} />
        </>
      ) : null}
      <Text style={[t.bodySmall, { fontSize: 12, color: selected ? c.paper : c.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <SemLabel text="Subject" />
      <View style={{ height: 6 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {pickChip(value == null, 'No subject', () => onChanged(null))}
        {subjects.map((s) => pickChip(value === s.id, s.name, () => onChanged(s.id), s.color, s.id))}
        {pickChip(false, '+ New subject…', () => setCreating(true))}
      </View>
      {creating ? (
        <>
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SemTextField
                value={name}
                autoFocus
                placeholder="e.g. Mathematics"
                onChangeText={setName}
                onSubmitEditing={create}
              />
            </View>
            <View style={{ width: 8 }} />
            <SemPrimaryButton onPress={create}>Add</SemPrimaryButton>
            <View style={{ width: 8 }} />
            <SemGhostButton
              onPress={() => {
                setName('');
                setCreating(false);
              }}
            >
              Cancel
            </SemGhostButton>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** round check button — filled accent when done (CheckDot / _RoundCheck) */
export function RoundCheck({
  done,
  onTap,
  size = 20,
}: {
  done: boolean;
  onTap?: () => void;
  size?: number;
}) {
  const { c } = useSem();
  return (
    <Pressable
      onPress={onTap}
      hitSlop={4}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: done ? c.accent : 'transparent',
        borderWidth: 1,
        borderColor: done ? c.accent : `${c.ink}4D`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? (
        <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: size * 0.6, lineHeight: size * 0.6, color: c.paper }}>
          {'\ue668'}
        </Text>
      ) : null}
    </Pressable>
  );
}
