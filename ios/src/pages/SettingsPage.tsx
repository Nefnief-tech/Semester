/* Port of settings_page.dart — the account surface as a first-class
 * destination. Android's home-screen widgets become an iPad/iPhone note:
 * iOS widgets are added from the home-screen gallery (the WidgetKit target
 * is the one deferred native piece — see README). */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AuthPanel } from './AuthPanel';
import { PageHeader, SemCard, SemLabel } from '../components/controls';
import { usePaneWidth } from '../components/pane';
import { useSem } from '../theme/theme';

export function SettingsPage(): React.JSX.Element {
  const { c, t } = useSem();
  const width = usePaneWidth();
  const regular = width >= 768;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: regular ? 40 : 16, paddingTop: 16, paddingBottom: 32 }}>
      <PageHeader title="Settings" subtitle="account · two-factor · sync · push" />
      <SemCard padding={16}>
        <AuthPanel />
      </SemCard>
      <View style={{ height: 24 }} />
      <SemLabel text="home-screen widgets" />
      <View style={{ height: 8 }} />
      <SemCard padding={16}>
        <Text style={[t.labelSmall, { color: c.inkSoft, lineHeight: 15.4 }]}>
          Add the Semester widgets from the home-screen gallery (long-press the home screen) — they follow your data
          automatically. The Up next and Timetable widgets ship with the app.
        </Text>
      </SemCard>
      <View style={{ height: 24 }} />
      <Text style={[t.labelSmall, { color: c.inkSoft, letterSpacing: 0.4 }]}>
        Semester for iOS · your data lives in your Appwrite project
      </Text>
    </ScrollView>
  );
}
