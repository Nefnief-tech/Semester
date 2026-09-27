/* Port of more_page.dart — the More tab holds Calendar, Grades, Study Room
 * and Settings; on iPhone they open as pages with a back button, on iPad
 * they're sidebar destinations. */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useNav } from '../navigation';
import { PageHeader, SemCard } from '../components/controls';
import { Pressable } from '../components/motion';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import type { IconName } from '../components/icon_glyphs';

const ITEMS: Array<{ icon: IconName; label: string; hint: string; route: string }> = [
  { icon: 'calendar_month', label: 'Calendar', hint: 'exams, deadlines and events', route: 'calendar' },
  { icon: 'calculate', label: 'Grades', hint: 'points, averages per subject', route: 'grades' },
  { icon: 'auto_awesome', label: 'Study Room', hint: 'documents, flashcards and the AI tutor', route: 'study' },
  { icon: 'settings', label: 'Settings', hint: 'account, two-factor, sync and push', route: 'settings' },
];

export function MorePage(): React.JSX.Element {
  const { c, t } = useSem();
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
      style={{ flex: 1 }}
    >
      <PageHeader title="More" subtitle="calendar · grades · study · settings" />
      <SemCard padding={{ x: 0, y: 4 }}>
        {ITEMS.map((item, i) => (
          <React.Fragment key={item.route}>
            {i > 0 ? <View style={{ height: 1, marginLeft: 56, backgroundColor: c.line }} /> : null}
            <Pressable onPress={() => useNav.getState().handle(item.route)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}>
                <Icon name={item.icon} size={22} color={c.accent} />
                <View style={{ width: 16 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[t.bodyLarge, { fontWeight: '500' }]}>{item.label}</Text>
                  <Text style={[t.labelSmall, { color: c.inkSoft }]}>{item.hint}</Text>
                </View>
                <Icon name="chevron_right" size={18} color={c.inkSoft} />
              </View>
            </Pressable>
          </React.Fragment>
        ))}
      </SemCard>
    </ScrollView>
  );
}
