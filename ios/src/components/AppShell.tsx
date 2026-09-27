/* Port of AppShell.tsx: five main tabs (Overview · Tasks · Homework ·
 * Timetable · More) with the custom bottom bar on iPhone. Overflow
 * destinations (Calendar, Grades, Study Room, Settings) open as in-shell
 * pages with a back button, exactly like the pushed routes in the Flutter
 * app; all five tab panes stay mounted so scroll positions survive switching.
 *
 * iPad (regular width, the port's focus): the shell becomes a sidebar
 * layout — every destination is a permanent sidebar item, the content pane
 * never loses context, pages use the full width, and sheets render as
 * centered forms. Same content, iPad-native shell. */

import React, { useEffect } from 'react';
import { AppState, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TAB_HOMEWORK, TAB_MORE, TAB_OVERVIEW, TAB_TASKS, TAB_TIMETABLE, useNav, type OverflowPage } from '../navigation';
import { resync } from '../lib/sync';
import { useThemeStore } from '../stores/theme_store';
import { FONTS, SemThemeProvider, useSem, useSystemDark } from '../theme/theme';
import { PlannerGrid } from '../components/controls';
import { MeasuringPane, PaneWidthProvider } from '../components/pane';
import { FadeThrough, Pressable } from '../components/motion';
import { Icon, type IconName } from '../components/Icon';
import { DashboardPage } from '../pages/DashboardPage';
import { TodosPage } from '../pages/TodosPage';
import { HomeworkPage } from '../pages/HomeworkPage';
import { TimetablePage } from '../pages/TimetablePage';
import { MorePage } from '../pages/MorePage';
import { CalendarPage } from '../pages/CalendarPage';
import { GradesPage } from '../pages/GradesPage';
import { StudyRoomPage } from '../pages/StudyRoomPage';
import { SettingsPage } from '../pages/SettingsPage';

const TABS: Array<{ label: string; icon: IconName; index: number }> = [
  { label: 'Overview', icon: 'dashboard', index: TAB_OVERVIEW },
  { label: 'Tasks', icon: 'checklist', index: TAB_TASKS },
  { label: 'Homework', icon: 'menu_book', index: TAB_HOMEWORK },
  { label: 'Timetable', icon: 'table_chart', index: TAB_TIMETABLE },
  { label: 'More', icon: 'apps', index: TAB_MORE },
];

const PAGES: Array<{ label: string; icon: IconName; route: Exclude<OverflowPage, null> }> = [
  { label: 'Calendar', icon: 'calendar_month', route: 'calendar' },
  { label: 'Grades', icon: 'calculate', route: 'grades' },
  { label: 'Study Room', icon: 'auto_awesome', route: 'study' },
  { label: 'Settings', icon: 'settings', route: 'settings' },
];

export function AppShell(): React.JSX.Element {
  const darkSetting = useThemeStore((s) => s.dark);
  const setDark = useThemeStore((s) => s.setDark);
  const systemDark = useSystemDark();
  const effectiveDark = darkSetting ?? systemDark;

  useEffect(() => {
    // the process is suspended in background — realtime drops and events are
    // missed; pull everything again when the user comes back
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void resync();
    });
    return () => sub.remove();
  }, []);

  // NOTE: the SemThemeProvider lives in App.tsx so the dialog/picker hosts
  // render inside it too (they use useSem)
  return (
    <>
      <StatusBar style={effectiveDark ? 'light' : 'dark'} />
      <Shell />
    </>
  );
}

function Shell(): React.JSX.Element {
  const { width } = useWindowDimensions();
  return width >= 768 ? <SidebarShell /> : <PhoneShell />;
}

function Wordmark({ onPress }: { onPress?: () => void }): React.JSX.Element {
  const { c, t } = useSem();
  return (
    <Pressable onPress={onPress}>
      <Text style={[t.headlineSmall, { fontSize: 20, fontFamily: FONTS.display }]}>
        Semester
        <Text style={{ color: c.accent }}>.</Text>
      </Text>
    </Pressable>
  );
}

function ThemeToggle(): React.JSX.Element {
  const { c } = useSem();
  const darkSetting = useThemeStore((s) => s.dark);
  const setDark = useThemeStore((s) => s.setDark);
  const systemDark = useSystemDark();
  const effectiveDark = darkSetting ?? systemDark;
  return (
    <Pressable
      onPress={() => setDark(!effectiveDark)}
      hitSlop={8}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={effectiveDark ? 'light_mode' : 'dark_mode'} size={19} color={c.inkSoft} />
    </Pressable>
  );
}

function TabContent({ tab }: { tab: number }): React.JSX.Element {
  switch (tab) {
    case TAB_OVERVIEW:
      return <DashboardPage />;
    case TAB_TASKS:
      return <TodosPage />;
    case TAB_HOMEWORK:
      return <HomeworkPage />;
    case TAB_TIMETABLE:
      return <TimetablePage />;
    default:
      return <MorePage />;
  }
}

function PageContent({ page }: { page: Exclude<OverflowPage, null> }): React.JSX.Element {
  switch (page) {
    case 'calendar':
      return <CalendarPage />;
    case 'grades':
      return <GradesPage />;
    case 'study':
      return <StudyRoomPage />;
    case 'settings':
      return <SettingsPage />;
  }
}

/* ================= iPhone layout ================= */

function PhoneShell(): React.JSX.Element {
  const tab = useNav((s) => s.tab);
  const page = useNav((s) => s.page);
  const { c, t } = useSem();
  const windowWidth = useWindowDimensions().width;

  const currentLabel =
    page != null ? PAGES.find((p) => p.route === page)!.label : TABS[Math.min(tab, TABS.length - 1)].label;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['top']}>
      {/* header */}
      <View style={{ borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.paper }}>
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          {page != null ? (
            <Pressable
              onPress={() => useNav.getState().closePage()}
              hitSlop={8}
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: -8 }}
            >
              <Icon name="chevron_left" size={24} color={c.ink} />
            </Pressable>
          ) : (
            <Wordmark onPress={() => useNav.getState().setTab(TAB_OVERVIEW)} />
          )}
          {page != null ? (
            <Text style={[t.headlineSmall, { fontSize: 18, flex: 1, marginLeft: 4 }]}>{currentLabel}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {page == null ? (
            <Text style={[t.labelSmall, { letterSpacing: 1.4, marginRight: 8 }]}>{currentLabel.toUpperCase()}</Text>
          ) : null}
          <ThemeToggle />
        </View>
      </View>

      {/* content: the active page, or the kept-alive tab content — pane
          width = window width on phone */}
      <PaneWidthProvider width={windowWidth}>
        {page != null ? (
          <PlannerGrid style={{ flex: 1 }}>
            <FadeThrough key={page}>
              <PageContent page={page} />
            </FadeThrough>
          </PlannerGrid>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {TABS.map((entry) => (
              <View key={entry.index} style={{ flex: 1, display: tab === entry.index ? 'flex' : 'none' }}>
                <PlannerGrid style={{ flex: 1 }}>
                  <TabContent tab={entry.index} />
                </PlannerGrid>
              </View>
            ))}
          </View>
        )}
      </PaneWidthProvider>

      {/* bottom bar */}
      {page == null ? (
        <View
          style={{
            backgroundColor: `${c.paper}F7`,
            borderTopWidth: 1,
            borderColor: c.line,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', paddingTop: 6 }}>
            {TABS.map((entry) => {
              const active = tab === entry.index;
              return (
                <Pressable
                  key={entry.index}
                  onPress={() => useNav.getState().setTab(entry.index)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
                >
                  <Icon name={entry.icon} filled={active} size={21} color={active ? c.accent : c.inkSoft} />
                  <View style={{ height: 3 }} />
                  <Text
                    numberOfLines={1}
                    style={[
                      t.labelSmall,
                      {
                        fontSize: 9,
                        letterSpacing: 0.2,
                        fontWeight: active ? '600' : '400',
                        color: active ? c.accent : c.inkSoft,
                      },
                    ]}
                  >
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/* ================= iPad layout (the focus) ================= */

function SidebarShell(): React.JSX.Element {
  const tab = useNav((s) => s.tab);
  const page = useNav((s) => s.page);
  const { c, t } = useSem();
  const { width } = useWindowDimensions();
  const sidebarWidth = Math.min(300, Math.max(240, Math.round(width * 0.22)));
  // the four overflow destinations are permanent sidebar items here — the
  // phone-only "More" hub would list them a second time
  const sidebarTabs = TABS.filter((e) => e.index !== TAB_MORE);
  const effectiveTab = tab === TAB_MORE ? TAB_OVERVIEW : tab;

  const sidebarItem = (
    label: string,
    icon: IconName,
    active: boolean,
    onPress: () => void,
    key: string,
  ) => (
    <Pressable key={key} onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          marginBottom: 3,
          backgroundColor: active ? c.ink : 'transparent',
        }}
      >
        <Icon name={icon} filled={active} size={19} color={active ? c.paper : c.inkSoft} />
        <View style={{ width: 12 }} />
        <Text
          style={[t.bodyMedium, { fontWeight: active ? '500' : '400', color: active ? c.paper : c.ink, flex: 1 }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, flexDirection: 'row', backgroundColor: c.paper }} edges={['top']}>
      {/* sidebar */}
      <View
        style={{
          width: sidebarWidth,
          borderRightWidth: 1,
          borderColor: c.line,
          backgroundColor: c.paperDeep,
          paddingTop: 20,
          paddingHorizontal: 14,
        }}
      >
        <View style={{ paddingHorizontal: 8, marginBottom: 24 }}>
          <Wordmark />
        </View>
        {sidebarTabs.map((entry) =>
          sidebarItem(
            entry.label,
            entry.icon,
            page == null && effectiveTab === entry.index,
            () => useNav.getState().setTab(entry.index),
            `tab-${entry.index}`,
          ),
        )}
        <View style={{ height: 1, backgroundColor: c.line, marginVertical: 16, marginHorizontal: 8 }} />
        {PAGES.map((entry) =>
          sidebarItem(
            entry.label,
            entry.icon,
            page === entry.route,
            () => useNav.getState().handle(entry.route),
            `page-${entry.route}`,
          ),
        )}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 12 }}>
          <Text style={[t.labelSmall, { color: c.inkSoft, flex: 1 }]}>Semester for iPad</Text>
          <ThemeToggle />
        </View>
      </View>

      {/* content pane — self-measuring so pages size against the pane,
          not the window (the sidebar eats into the window width) */}
      <MeasuringPane>
        {page != null ? (
          <View style={{ borderBottomWidth: 1, borderColor: c.line }}>
            <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40 }}>
              <Text style={[t.headlineSmall, { fontSize: 18, flex: 1 }]}>
                {PAGES.find((p) => p.route === page)!.label}
              </Text>
              <ThemeToggle />
            </View>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {/* tabs stay mounted; pages fade through on top */}
          <View style={{ flex: 1, flexDirection: 'row', display: page == null ? 'flex' : 'none' }}>
            {TABS.map((entry) => (
              <View key={entry.index} style={{ flex: 1, display: effectiveTab === entry.index ? 'flex' : 'none' }}>
                <PlannerGrid style={{ flex: 1 }}>
                  <TabContent tab={entry.index} />
                </PlannerGrid>
              </View>
            ))}
          </View>
          {page != null ? (
            <PlannerGrid style={{ ...({ position: 'absolute' } as const), top: 0, left: 0, right: 0, bottom: 0 }}>
              <FadeThrough key={page}>
                <PageContent page={page} />
              </FadeThrough>
            </PlannerGrid>
          ) : null}
        </View>
      </MeasuringPane>
    </SafeAreaView>
  );
}
