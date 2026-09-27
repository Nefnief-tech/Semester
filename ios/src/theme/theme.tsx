/* Port of the web app's `src/app/globals.css` (the stationery palette) and
 * the mobile app's `lib/theme/app_theme.dart`. Light values from `:root`,
 * dark values from `.dark`. Fonts are the same families the web app loads
 * via next/font, bundled as assets so everything renders offline. */

import React, { createContext, useContext, useMemo } from 'react';
import { TextStyle, useColorScheme } from 'react-native';

import type { Tone } from '../models/types';

export interface SemColors {
  paper: string;
  paperDeep: string;
  card: string;
  ink: string;
  inkSoft: string;
  line: string;
  grid: string;
  accent: string;
  accentSoft: string;
  marker: string;
  info: string;
  amber: string;
}

export const LIGHT_COLORS: SemColors = {
  paper: '#F5F2EA',
  paperDeep: '#EDEADE',
  card: '#FDFCF8',
  ink: '#26221B',
  inkSoft: '#756E60',
  line: '#E0DACB',
  grid: '#E8E3D5',
  accent: '#31633F',
  accentSoft: '#E2EADD',
  marker: '#C14B26',
  info: '#38618C',
  amber: '#8A6A10',
};

export const DARK_COLORS: SemColors = {
  paper: '#17150F',
  paperDeep: '#1E1B14',
  card: '#211E17',
  ink: '#ECE6D6',
  inkSoft: '#A29A88',
  line: '#353025',
  grid: '#251F15',
  accent: '#8FB99A',
  accentSoft: '#253528',
  marker: '#E08A63',
  info: '#8FB4DD',
  amber: '#D9B95C',
};

export const FONTS = {
  display: 'Fraunces',
  displayItalic: 'Fraunces_Italic',
  body: 'Instrument Sans',
  mono: 'IBM Plex Mono',
  symbols: 'MaterialSymbolsOutlined',
} as const;

interface TextSet {
  displayLarge: TextStyle;
  displayMedium: TextStyle;
  displaySmall: TextStyle;
  headlineMedium: TextStyle;
  headlineSmall: TextStyle;
  titleLarge: TextStyle;
  titleMedium: TextStyle;
  titleSmall: TextStyle;
  bodyLarge: TextStyle;
  bodyMedium: TextStyle;
  bodySmall: TextStyle;
  labelLarge: TextStyle;
  labelMedium: TextStyle;
  labelSmall: TextStyle;
}

function textSet(c: SemColors): TextSet {
  const display = (fontSize: number, fontWeight: TextStyle['fontWeight'], height: number): TextStyle => ({
    fontFamily: FONTS.display,
    fontSize,
    fontWeight,
    lineHeight: Math.round(fontSize * height),
    color: c.ink,
  });
  const body = (fontSize: number, fontWeight: TextStyle['fontWeight'], height: number, color = c.ink): TextStyle => ({
    fontFamily: FONTS.body,
    fontSize,
    fontWeight,
    lineHeight: Math.round(fontSize * height),
    color,
  });
  const mono = (
    fontSize: number,
    fontWeight: TextStyle['fontWeight'],
    letterSpacing: number,
    color = c.inkSoft,
  ): TextStyle => ({ fontFamily: FONTS.mono, fontSize, fontWeight, letterSpacing, color });
  return {
    displayLarge: display(40, '600', 1.05),
    displayMedium: display(34, '600', 1.08),
    displaySmall: display(28, '600', 1.12),
    headlineMedium: display(24, '600', 1.15),
    headlineSmall: display(20, '600', 1.2),
    titleLarge: display(18, '600', 1.25),
    titleMedium: body(16, '500', 1.3),
    titleSmall: body(14, '500', 1.3),
    bodyLarge: body(15, '400', 1.5),
    bodyMedium: body(14, '400', 1.45),
    bodySmall: body(12, '400', 1.4, c.inkSoft),
    labelLarge: mono(13, '500', 0.8, c.ink),
    labelMedium: mono(11, '400', 0.8, c.inkSoft),
    labelSmall: mono(10, '400', 1.1, c.inkSoft),
  };
}

export interface SemTheme {
  dark: boolean;
  /** the stationery palette for the current brightness */
  c: SemColors;
  /** the text styles (Flutter's TextTheme equivalents) */
  t: TextSet;
}

const ThemeContext = createContext<SemTheme | null>(null);

export function SemThemeProvider({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  const theme = useMemo<SemTheme>(() => {
    const c = dark ? DARK_COLORS : LIGHT_COLORS;
    return { dark, c, t: textSet(c) };
  }, [dark]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** `context.sem` equivalent — the stationery theme for the current brightness */
export function useSem(): SemTheme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useSem outside SemThemeProvider');
  return theme;
}

/** resolves the effective dark flag: explicit store value wins, else system */
export function useSystemDark(): boolean {
  const scheme = useColorScheme();
  return scheme === 'dark';
}

/** colorFromHex from bits.dart — "#RRGGBB" → rgba int */
export function colorFromHex(hex: string): string {
  const h = hex.replace('#', '');
  return h.length === 6 ? `#${h}` : '#3E6B4F';
}

/** tone → palette color (toneColor from bits.dart) */
export function toneColor(c: SemColors, tone: Tone): string {
  switch (tone) {
    case 'good':
      return c.accent;
    case 'ok':
      return c.info;
    case 'warn':
      return c.amber;
    case 'bad':
      return c.marker;
    default:
      return c.inkSoft;
  }
}
