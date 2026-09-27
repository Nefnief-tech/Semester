/* Material Symbols icon — the Flutter app's `Icons.*` rendered through the
 * bundled variable font. The FILL axis flips via fontVariations so tabs get
 * the filled variant when selected, exactly like the Dart pairs. */

import React from 'react';
import { Text, TextStyle } from 'react-native';

import { FONTS } from '../theme/theme';
import { ICON_GLYPHS, IconName } from './icon_glyphs';

export function Icon({
  name,
  size = 20,
  color,
  filled = false,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
  style?: TextStyle;
}): React.JSX.Element {
  // fontVariations is supported by the renderer but not yet in the TextStyle
  // types — cast on the way in
  const variations = {
    fontVariations: [
      { FILL: filled ? 1 : 0 },
      { wght: 400 },
      { GRAD: 0 },
      { opsz: Math.min(48, Math.max(20, Math.round(size))) },
    ],
  } as unknown as TextStyle;

  return (
    <Text
      style={[
        {
          fontFamily: FONTS.symbols,
          fontSize: size,
          color,
          // keep glyph metrics tight, like an icon font should
          lineHeight: size,
        },
        variations,
        style,
      ]}
    >
      {ICON_GLYPHS[name]}
    </Text>
  );
}

export type { IconName };
