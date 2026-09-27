/* Themed confirm dialog (the window.confirm / AlertDialog port). An
 * imperative `confirmDialog()` resolves a promise through a single host
 * component mounted once by the app root. */

import React, { useState } from 'react';
import { Modal, Pressable as RNPressable, Text, View, useWindowDimensions } from 'react-native';

import { useSem } from '../theme/theme';

interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel: string;
}

type Resolver = (ok: boolean) => void;

let push: ((config: ConfirmConfig, resolver: Resolver) => void) | null = null;

export function confirmDialog(
  message: string,
  options: { title?: string; confirmLabel?: string } = {},
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) {
      // no host mounted yet — refusing is safer than deleting something
      resolve(false);
      return;
    }
    push(
      {
        title: options.title ?? 'Are you sure?',
        message,
        confirmLabel: options.confirmLabel ?? 'Delete',
      },
      resolve,
    );
  });
}

export function ConfirmDialogHost(): React.JSX.Element {
  const { c, t } = useSem();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<ConfirmConfig | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);

  push = (config, r) => {
    setOpen(config);
    setResolver(() => r);
  };

  const finish = (ok: boolean) => {
    resolver?.(ok);
    setOpen(null);
    setResolver(null);
  };

  return (
    <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => finish(false)}>
      <RNPressable
        onPress={() => finish(false)}
        style={{ flex: 1, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 20,
            padding: 24,
            width: Math.min(380, width - 48),
          }}
        >
          <Text style={[t.titleLarge, { fontSize: 18 }]}>{open?.title}</Text>
          <View style={{ height: 10 }} />
          <Text style={t.bodyMedium}>{open?.message}</Text>
          <View style={{ height: 20 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}>
            <RNPressable hitSlop={8} onPress={() => finish(false)}>
              <Text style={[t.bodyMedium, { color: c.inkSoft }]}>Cancel</Text>
            </RNPressable>
            <RNPressable hitSlop={8} onPress={() => finish(true)}>
              <Text style={[t.bodyMedium, { color: c.marker, fontWeight: '600' }]}>{open?.confirmLabel}</Text>
            </RNPressable>
          </View>
        </View>
      </RNPressable>
    </Modal>
  );
}
