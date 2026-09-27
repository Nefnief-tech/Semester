/* `semester://<route>` deeplinks — semester://timetable, semester://homework,
 * semester://calendar … (the scheme is registered in app.json). */

import * as Linking from 'expo-linking';

import { useNav } from '../navigation';

export function initLinks(): () => void {
  const dispatch = (url: string | null): void => {
    if (!url) return;
    try {
      const parsed = Linking.parse(url);
      // semester://timetable → hostname 'timetable', path ''; also tolerate
      // semester:///timetable (path form)
      const route = (parsed.hostname || parsed.path || '').split('/')[0].toLowerCase();
      if (route) useNav.getState().handle(route);
    } catch {
      // a malformed link must never crash the app
    }
  };

  Linking.getInitialURL().then((url) => {
    if (url) dispatch(url);
  });

  const sub = Linking.addEventListener('url', ({ url }) => dispatch(url));
  return () => sub.remove();
}
