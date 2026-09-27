/* Navigation bus — port of `lib/navigation.dart`. Bottom-bar taps switch
 * tabs, while push taps (`data.route`) and deeplinks (`semester://<route>`)
 * land on the page they name: main destinations switch tabs, overflow
 * destinations (calendar, grades, study, settings) open as in-shell pages
 * with their own back button. Routes that arrive before the shell mounted
 * are queued. */

import { create } from 'zustand';

/** tab indices — the five bottom-bar slots */
export const TAB_OVERVIEW = 0;
export const TAB_TASKS = 1;
export const TAB_HOMEWORK = 2;
export const TAB_TIMETABLE = 3;
export const TAB_MORE = 4;

export type OverflowPage = 'calendar' | 'grades' | 'study' | 'settings' | null;

interface NavState {
  tab: number;
  /** the pushed page on top of the shell (null = tab content only) */
  page: OverflowPage;
  handle: (route: string) => void;
  setTab: (tab: number) => void;
  openPage: (page: Exclude<OverflowPage, null>) => void;
  closePage: () => void;
}

export const useNav = create<NavState>((set) => ({
  tab: TAB_OVERVIEW,
  page: null,
  setTab: (tab) => set({ tab, page: null }),
  openPage: (page) => set({ page }),
  closePage: () => set({ page: null }),
  handle: (route) => {
    const { setTab, openPage } = useNav.getState();
    switch (route) {
      case 'calendar':
        openPage('calendar');
        break;
      case 'grades':
        openPage('grades');
        break;
      case 'study':
        openPage('study');
        break;
      case 'settings':
      case 'account':
        openPage('settings');
        break;
      case 'homework':
        setTab(TAB_HOMEWORK);
        break;
      case 'tasks':
        setTab(TAB_TASKS);
        break;
      case 'timetable':
        setTab(TAB_TIMETABLE);
        break;
      case 'overview':
      case 'home':
        setTab(TAB_OVERVIEW);
        break;
    }
  },
}));
