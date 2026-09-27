/* Semester for iOS — root component. Restores the persisted stores, loads
 * the bundled fonts, then starts the sync engine, push and deeplinks.
 * Every startup gate is non-fatal: a stuck font load or store hydration
 * must degrade to fallback fonts / an empty-looking app, never a black
 * screen (boot markers land in the Metro log for diagnosis). */

import React, { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import { AppShell } from './src/components/AppShell';
import { ConfirmDialogHost } from './src/components/confirm_dialog';
import { DateTimePickerHost } from './src/components/pickers';
import { initLinks } from './src/lib/links';
import { PushService } from './src/lib/push';
import { initSync } from './src/lib/sync';
import { whenHydrated } from './src/stores/hydration';
import { useThemeStore } from './src/stores/theme_store';
import { SemThemeProvider, useSystemDark } from './src/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    Fraunces: require('./assets/fonts/Fraunces-VF.ttf'),
    Fraunces_Italic: require('./assets/fonts/Fraunces-Italic-VF.ttf'),
    'Instrument Sans': require('./assets/fonts/InstrumentSans-VF.ttf'),
    'IBM Plex Mono': require('./assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBM Plex Mono Medium': require('./assets/fonts/IBMPlexMono-Medium.ttf'),
    'IBM Plex Mono SemiBold': require('./assets/fonts/IBMPlexMono-SemiBold.ttf'),
    MaterialSymbolsOutlined: require('./assets/fonts/MaterialSymbolsOutlined.ttf'),
  });
  const [fontGateOpen, setFontGateOpen] = useState(false);

  const darkSetting = useThemeStore((s) => s.dark);
  const systemDark = useSystemDark();
  const effectiveDark = darkSetting ?? systemDark;

  // insurance: never hold the UI hostage to a stalled font load — after 10 s
  // continue with the system fonts (the log tells us this happened)
  useEffect(() => {
    if (fontsLoaded) return;
    const timer = setTimeout(() => {
      console.warn('[boot] font load timed out — continuing with system fonts');
      setFontGateOpen(true);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // hydrate all stores from AsyncStorage (zustand-persist) before the
      // sync engine touches anything — but a stuck store must never wedge
      // the app into a black screen, so surface the culprit in the log and
      // continue (rehydrating stores re-trigger row syncs via their
      // subscribers, and the sync design is safe on empty stores: no local
      // entities + no digests = pure pull)
      console.log('[boot] fonts loaded, hydrating stores…');
      await useThemeStore.getState().init();
      await whenHydrated().catch((e) =>
        console.warn('[boot] store hydration incomplete, continuing:', String(e)),
      );
      if (cancelled) return;
      console.log('[boot] ready');
      void SplashScreen.hideAsync().catch(() => {});
      await initSync();
      void PushService.init();
      initLinks();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsLoaded && !fontGateOpen) {
    // the native splash screen is still covering us
    return null;
  }
  return (
    <SemThemeProvider dark={effectiveDark}>
      <AppShell />
      <ConfirmDialogHost />
      <DateTimePickerHost />
    </SemThemeProvider>
  );
}
