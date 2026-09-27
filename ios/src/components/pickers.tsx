/* Mobile replacement for `<input type="datetime-local">` — port of
 * `lib/widgets/datetime_field.dart`. Native spinners inside a themed card:
 * date then time for due dates; produces the same strings the stores use. */

import React, { useRef, useState } from 'react';
import { Modal, Pressable as RNPressable, Text, View, useWindowDimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useSem } from '../theme/theme';
import { parseDue, toDayKey } from '../utils/utils';

type Resolve = (value: Date | null) => void;

interface PickerConfig {
  mode: 'date' | 'time';
  initial: Date;
  title: string;
}

let openPicker: ((config: PickerConfig, resolve: Resolve) => void) | null = null;

function show(config: PickerConfig): Promise<Date | null> {
  return new Promise((resolve) => {
    if (!openPicker) {
      resolve(null);
      return;
    }
    openPicker(config, resolve);
  });
}

/** datetime-local picker: date then time — "yyyy-MM-ddTHH:mm" */
export async function pickDueDateTime(current?: string | null): Promise<string | null> {
  const initial = parseDue(current ?? '') ?? new Date();
  const date = await show({ mode: 'date', initial, title: 'Pick a date' });
  if (!date) return null;
  const defaultTime = current && current.includes('T') ? initial : new Date(2026, 0, 1, 17, 0);
  const time = await show({ mode: 'time', initial: defaultTime, title: 'Pick a time' });
  const d = time ?? date;
  return `${toDayKey(date)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** plain yyyy-MM-dd picker (events, grades) */
export async function pickDate(current?: string | null): Promise<string | null> {
  const initial = parseDue(current ?? '') ?? new Date();
  const date = await show({ mode: 'date', initial, title: 'Pick a date' });
  return date ? toDayKey(date) : null;
}

/** plain HH:mm picker */
export async function pickTime(current?: string | null): Promise<string | null> {
  const parts = (current ?? '').split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const initial =
    Number.isFinite(h) && Number.isFinite(m) ? new Date(2026, 0, 1, h, m) : new Date();
  const time = await show({ mode: 'time', initial, title: 'Pick a time' });
  if (!time) return null;
  return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
}

/** "2026-09-21 · 17:00" — the plain value label used in form fields */
export function dueLabel(due?: string | null): string {
  const d = parseDue(due);
  if (!d || !due) return '';
  const hasTime = due.includes('T');
  return `${toDayKey(d)}${hasTime ? ` · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''}`;
}

export function DateTimePickerHost(): React.JSX.Element {
  const { c, t } = useSem();
  const { width } = useWindowDimensions();
  const [config, setConfig] = useState<PickerConfig | null>(null);
  const valueRef = useRef<Date>(new Date());
  const resolverRef = useRef<Resolve | null>(null);

  openPicker = (cfg, resolve) => {
    setConfig(cfg);
    valueRef.current = cfg.initial;
    resolverRef.current = resolve;
  };

  const finish = (result: Date | null) => {
    resolverRef.current?.(result);
    setConfig(null);
    resolverRef.current = null;
  };

  return (
    <Modal visible={config != null} transparent animationType="fade" onRequestClose={() => finish(null)}>
      <RNPressable
        onPress={() => finish(null)}
        style={{ flex: 1, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 20,
            padding: 16,
            width: Math.min(340, width - 48),
            alignItems: 'center',
          }}
        >
          <Text style={[t.titleLarge, { fontSize: 16 }]}>{config?.title}</Text>
          <View style={{ height: 8 }} />
          {config ? (
            <DateTimePicker
              value={config.initial}
              mode={config.mode}
              display="spinner"
              onChange={(_e, date) => {
                if (date) valueRef.current = date;
              }}
              style={{ width: '100%' }}
            />
          ) : null}
          <View style={{ height: 8 }} />
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <RNPressable hitSlop={8} onPress={() => finish(null)}>
              <Text style={[t.bodyMedium, { color: c.inkSoft }]}>Cancel</Text>
            </RNPressable>
            <RNPressable hitSlop={8} onPress={() => finish(valueRef.current)}>
              <Text style={[t.bodyMedium, { color: c.accent, fontWeight: '600' }]}>OK</Text>
            </RNPressable>
          </View>
        </View>
      </RNPressable>
    </Modal>
  );
}
