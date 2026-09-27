/* Port of `lib/widgets/controls.dart` — the web app's `.btn-primary`,
 * `.btn-ghost`, `.btn-icon`, `.card`, `.label`, the segmented pill group, the
 * bottom-sheet modal (bottom sheet on iPhone, centered form on iPad) and the
 * planner dot-grid background. */

import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable as RNPressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSem } from '../theme/theme';
import { Icon } from './Icon';
import { Pressable } from './motion';
import { confirmDialog } from './confirm_dialog';

/* ---------------- buttons ---------------- */

export function SemPrimaryButton({
  onPress,
  children,
  disabled,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, t } = useSem();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: disabled ? `${c.ink}66` : c.ink,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[t.bodyMedium, { color: c.paper, fontWeight: '500' }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function SemGhostButton({
  onPress,
  children,
  foreground,
  border,
  disabled,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  foreground?: string;
  border?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, t } = useSem();
  const fg = disabled ? c.inkSoft : (foreground ?? c.ink);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: border ?? c.line,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[t.bodyMedium, { color: fg }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function SemIconButton({
  onPress,
  icon,
  color,
  size = 18,
  filled = false,
  disabled,
}: {
  onPress?: () => void;
  icon: React.ComponentProps<typeof Icon>['name'];
  color?: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
}) {
  const { c } = useSem();
  return (
    <RNPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
    >
      {({ pressed }) => (
        <Icon
          name={icon}
          size={size}
          filled={filled}
          color={disabled ? c.inkSoft : color ?? c.inkSoft}
          style={{ opacity: pressed ? 0.55 : 1 }}
        />
      )}
    </RNPressable>
  );
}

/* ---------------- segmented toggle ---------------- */

export function SegToggle<T>({
  options,
  selected,
  onChanged,
}: {
  options: Array<[T, string]>;
  selected: T;
  onChanged: (value: T) => void;
}) {
  const { c, t } = useSem();
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 2,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 14,
        alignSelf: 'flex-start',
      }}
    >
      {options.map(([value, label]) => {
        const active = value === selected;
        return (
          <RNPressable
            key={String(label)}
            onPress={() => onChanged(value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              backgroundColor: active ? c.ink : 'transparent',
            }}
          >
            <Text
              style={[
                t.labelMedium,
                { fontSize: 11, color: active ? c.paper : c.inkSoft, fontWeight: '500' },
              ]}
            >
              {label.toUpperCase()}
            </Text>
          </RNPressable>
        );
      })}
    </View>
  );
}

/* ---------------- cards & labels ---------------- */

export function SemCard({
  children,
  padding = 0,
  color,
  borderColor,
  onPress,
  style,
}: {
  children: React.ReactNode;
  padding?: number | { x?: number; y?: number };
  color?: string;
  borderColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useSem();
  const pad =
    typeof padding === 'number'
      ? { padding }
      : { paddingHorizontal: padding.x ?? 0, paddingVertical: padding.y ?? 0 };
  const card = (
    <View
      style={[
        {
          backgroundColor: color ?? c.card,
          borderWidth: 1,
          borderColor: borderColor ?? c.line,
          borderRadius: 20,
          overflow: 'hidden',
        },
        pad,
        style,
      ]}
    >
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{card}</Pressable> : card;
}

/** `.label` — mono uppercase section label */
export function SemLabel({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const { c, t } = useSem();
  return (
    <View style={style}>
      <Text style={[t.labelSmall, { fontSize: 11, letterSpacing: 0.9, color: c.inkSoft }]}>
        {text.toUpperCase()}
      </Text>
    </View>
  );
}

/** page header — big Fraunces title + mono subtitle, like every web page */
export function PageHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  const { t } = useSem();
  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text style={[t.displayMedium, { flex: 1 }]}>{title}</Text>
        {trailing}
      </View>
      {subtitle ? (
        <>
          <View style={{ height: 4 }} />
          <Text style={[t.labelMedium, { fontSize: 12, letterSpacing: 0.4 }]}>{subtitle}</Text>
        </>
      ) : null}
    </View>
  );
}

/* ---------------- text field ---------------- */

export function SemTextField({
  style,
  suffix,
  ...props
}: TextInputProps & { suffix?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, t } = useSem();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TextInput
        placeholderTextColor={`${c.inkSoft}99`}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            flex: 1,
            backgroundColor: c.card,
            borderRadius: 14,
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? c.accent : c.line,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: c.ink,
            fontFamily: t.bodyMedium.fontFamily,
          },
          style,
        ]}
      />
      {suffix ? <View style={{ position: 'absolute', right: 10 }}>{suffix}</View> : null}
    </View>
  );
}

/* ---------------- bottom-sheet modal (port of Modal.tsx) ----------------
 * the web Modal renders as a bottom sheet on phones — on iPhone it is a
 * bottom sheet everywhere, on iPad a centered form (like the web) */

export function SemSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { c, t } = useSem();
  const { width, height } = useWindowDimensions();
  const regular = width >= 768;

  const card = (
    <View
      onStartShouldSetResponder={() => true} // absorb taps so the backdrop won't close
      style={{
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        overflow: 'hidden',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        ...(regular
          ? {
              borderRadius: 20,
              alignSelf: 'center',
              width: Math.min(560, width - 48),
              maxHeight: height * 0.85,
            }
          : { maxHeight: height * 0.92 }),
      }}
    >
      {!regular ? (
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.line }} />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 20,
          paddingRight: 12,
          paddingTop: 4,
          paddingBottom: 12,
        }}
      >
        <Text style={[t.headlineSmall, { flex: 1 }]}>{title}</Text>
        <SemIconButton icon="close" onPress={onClose} />
      </View>
      <View style={{ height: 1, backgroundColor: c.line }} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType={regular ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <SafeAreaView edges={regular ? [] : ['bottom']} style={{ flex: 1 }}>
          <RNPressable
            onPress={onClose}
            style={{
              flex: 1,
              backgroundColor: '#00000055',
              justifyContent: regular ? 'center' : 'flex-end',
            }}
          >
            {card}
          </RNPressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------------- planner grid background (the dotted desk) ---------------- */

const gridTiles = {
  light: require('../../assets/grid-light.png'),
  dark: require('../../assets/grid-dark.png'),
};

export function PlannerGrid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { dark } = useSem();
  return (
    <View style={[{ flex: 1, backgroundColor: dark ? '#17150F' : '#F5F2EA' }, style]}>
      {/* the dots must sit behind the content — in the foreground they
          floated over every card (Flutter comment preserved). A 22×22 tile
          repeated by the native image view = the CSS dot grid. */}
      <Image
        source={dark ? gridTiles.dark : gridTiles.light}
        resizeMode="repeat"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}

export { confirmDialog };
