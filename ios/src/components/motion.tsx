/* Shared motion — port of `lib/widgets/motion.dart`: fast, understated,
 * ease-out. Press feedback scales to 0.98; pushed pages fade through. */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, GestureResponderEvent, Pressable as RNPressable, StyleProp, ViewStyle } from 'react-native';

export const MOTION_FAST_MS = 150;
export const MOTION_BASE_MS = 240;
const MOTION_EASING = Easing.out(Easing.cubic);

/** subtle press feedback: scales to 0.98 while pressed, springs back on
 * release — wrap any tappable card or tile (port of Pressable.dart) */
export function Pressable({
  children,
  onPress,
  style,
  disabled,
  hitSlop,
}: {
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const [down, setDown] = useState(false);

  useEffect(() => {
    Animated.timing(scale, {
      toValue: down && !disabled ? 0.98 : 1,
      duration: MOTION_FAST_MS,
      easing: MOTION_EASING,
      useNativeDriver: true,
    }).start();
  }, [down, disabled, scale]);

  return (
    <RNPressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      // layout + visual styles belong on the outer touchable — on the inner
      // wrapper they'd be no-ops whenever this is a flex child (flex: 1,
      // widths in rows…), leaving e.g. the dashboard strip cells bunched
      style={style}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      accessible
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </RNPressable>
  );
}

/** page transition for pushed pages (More destinations): content fades in
 * while sliding up a couple of pixels — port of FadeThroughRoute */
export function FadeThrough({ children }: { children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: MOTION_BASE_MS,
      easing: MOTION_EASING,
      useNativeDriver: true,
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
