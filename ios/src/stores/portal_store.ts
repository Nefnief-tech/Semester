/* Port of `lib/stores/portal_store.dart` — school portal settings + the last
 * fetched substitute plan. Device-local ONLY: credentials never leave this
 * device (or get synced), they are sent per-request to your own server. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import {
  PortalDay,
  PortalPlan,
  PortalSub,
  portalPlanFromJson,
  portalPlanToJson,
  portalSubFromJson,
} from '../models/types';
import { hashId } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

/** stable cloud row ids — content-derived so all clients agree */
export function portalSubRowId(e: PortalSub): string {
  return hashId(
    [
      e.date,
      e.weekday,
      e.period,
      e.course,
      e.courseOld ?? '',
      e.substitute,
      e.room,
      e.info,
      e.cancelled ? 'true' : 'false',
    ].join('|'),
  );
}
export function portalCourseRowId(course: string): string {
  return hashId(`course|${course}`);
}

export const DEFAULT_PORTAL_URL = 'https://evbspar.eltern-portal.org';

interface PortalState {
  baseUrl: string;
  username: string;
  password: string;
  autoFetch: boolean;
  data: PortalPlan | null;
  lastFetched: number | null;
  error: string | null;

  setSettings: (patch: {
    baseUrl?: string;
    username?: string;
    password?: string;
    autoFetch?: boolean;
  }) => void;
  setData: (plan: PortalPlan) => void;
  setError: (e: string | null) => void;
  clearData: () => void;

  // row-level sync
  upsertSub: (sub: PortalSub) => void;
  removeSub: (rowId: string) => void;
  upsertCourse: (course: string) => void;
  removeCourse: (rowId: string) => void;
}

export const usePortalStore = create<PortalState>()(
  persist<PortalState, [], [], Pick<PortalState, 'baseUrl' | 'username' | 'password' | 'autoFetch' | 'data' | 'lastFetched'>>(
    (set, get) => ({
      baseUrl: DEFAULT_PORTAL_URL,
      username: '',
      password: '',
      autoFetch: true,
      data: null,
      lastFetched: null,
      error: null,

      setSettings: (patch) =>
        set((s) => ({
          baseUrl: patch.baseUrl ?? s.baseUrl,
          username: patch.username ?? s.username,
          password: patch.password ?? s.password,
          autoFetch: patch.autoFetch ?? s.autoFetch,
        })),
      setData: (plan) => set({ data: plan, lastFetched: Date.now(), error: null }),
      setError: (e) => set({ error: e }),
      clearData: () => set({ data: null, lastFetched: null }),

      upsertSub: (sub) => {
        const data = get().data;
        if (!data) return;
        const rowId = portalSubRowId(sub);
        const days: PortalDay[] = data.days.map((d) => ({ ...d, entries: [...d.entries] }));
        let idx = days.findIndex((d) => d.date === sub.date);
        if (idx < 0) {
          days.push({ date: sub.date, weekday: sub.weekday, entries: [] });
          idx = days.length - 1;
        }
        const day = days[idx];
        days[idx] = {
          ...day,
          entries: [...day.entries.filter((e) => portalSubRowId(e) !== rowId), sub],
        };
        set({ data: { ...data, days } });
      },
      removeSub: (rowId) => {
        const data = get().data;
        if (!data) return;
        set({
          data: {
            ...data,
            days: data.days.map((d) => ({
              ...d,
              entries: d.entries.filter((e) => portalSubRowId(e) !== rowId),
            })),
          },
        });
      },
      upsertCourse: (course) => {
        const data = get().data;
        if (!data || data.courses.includes(course)) return;
        set({ data: { ...data, courses: [...data.courses, course] } });
      },
      removeCourse: (rowId) => {
        const data = get().data;
        if (!data) return;
        set({
          data: { ...data, courses: data.courses.filter((c) => portalCourseRowId(c) !== rowId) },
        });
      },
    }),
    {
      name: 'semester.portal',
      version: 1,
      storage: appStorage,
      partialize: (s: PortalState) => ({
        baseUrl: s.baseUrl,
        username: s.username,
        password: s.password,
        autoFetch: s.autoFetch,
        data: s.data ? portalPlanToJson(s.data) : null,
        lastFetched: s.lastFetched,
      }),
      merge: safeMerge((persisted: any, current: PortalState) => {
        const p = persisted as {
          baseUrl?: unknown;
          username?: unknown;
          password?: unknown;
          autoFetch?: unknown;
          data?: unknown;
          lastFetched?: unknown;
        };
        return {
          ...current,
          baseUrl: typeof p.baseUrl === 'string' && p.baseUrl ? p.baseUrl : current.baseUrl,
          username: typeof p.username === 'string' ? p.username : '',
          password: typeof p.password === 'string' ? p.password : '',
          autoFetch: p.autoFetch === undefined ? true : p.autoFetch === true,
          data:
            p.data && typeof p.data === 'object' && !Array.isArray(p.data)
              ? portalPlanFromJson(p.data as Record<string, unknown>)
              : null,
          lastFetched: typeof p.lastFetched === 'number' ? p.lastFetched : null,
        };
      }),
    } as unknown as PersistOptions<
      PortalState,
      Pick<PortalState, 'baseUrl' | 'username' | 'password' | 'autoFetch' | 'data' | 'lastFetched'>
    >,
  ),
);

export { portalSubFromJson };
