/* Push notifications — port of `lib/services/push.dart` onto APNs via
 * expo-notifications + Appwrite Messaging targets. Every step is guarded:
 * a missing permission or token must never break the app. */

import * as Notifications from 'expo-notifications';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPushTarget, deletePushTarget } from './appwrite';
import { useNav } from '../navigation';
import { SyncStatus, useAuthStore } from '../stores/auth_store';

export const PushService = {
  available: false,
  registered: false,

  _initialized: false,
  _token: null as string | null,
  _lastAuthStatus: null as SyncStatus | null,
  _targetId: null as string | null,
  _targetUserId: null as string | null,

  /** foreground: iOS does not surface notifications automatically */
  configureForeground(): void {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  },

  /** where a tapped push should land — the functions tag messages with
   * data.route ('timetable' · 'homework' · 'calendar'); AppNav resolves it */
  _navigate(route?: unknown): void {
    if (typeof route !== 'string' || !route) return;
    useNav.getState().handle(route);
  },

  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    this.configureForeground();

    // taps on a notification that opened/resumed the app → land on the page
    // the push is about
    Notifications.addNotificationResponseReceivedListener((response) => {
      this._navigate(response.notification.request.content.data?.route);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      this._navigate(response?.notification.request.content.data?.route);
    });

    try {
      const settings = await Notifications.getPermissionsAsync();
      let granted = settings.granted;
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.granted;
      }
      if (!granted) return;
      const token = await Notifications.getDevicePushTokenAsync();
      this.available = true;
      this._token = 'data' in token ? String((token as { data: string }).data) : String(token);
    } catch (e) {
      console.warn('[push] unavailable:', e);
      return;
    }

    useAuthStore.subscribe((state) => {
      const becameSignedIn =
        state.status === 'signed-in' && this._lastAuthStatus !== 'signed-in';
      this._lastAuthStatus = state.status;
      if (becameSignedIn) void this.syncTarget();
    });

    await this.syncTarget();
  },

  /** stable per-user, per-install target id: same user + same install keeps
   * one target (re-registration refreshes it), a different account on this
   * device gets its own — no 409s against targets owned by someone else */
  async _ensureTargetId(userId: string): Promise<string> {
    if (this._targetId && this._targetUserId === userId) return this._targetId;
    const key = `semester.pushtarget.${userId}`;
    let id = await AsyncStorage.getItem(key);
    if (!id) {
      let seed = await AsyncStorage.getItem('semester.pushtargetseed');
      if (!seed) {
        seed = `${Date.now() * 1000}${String(this._token ?? '').length}`;
        await AsyncStorage.setItem('semester.pushtargetseed', seed);
      }
      // xorshift-mixed install seed (expo-crypto keeps the scanner happy)
      const encoder = new TextEncoder();
      let h = 0x811c9dc5;
      for (const b of encoder.encode(`pushtarget:${seed}:${userId}`)) {
        h = Math.imul(h ^ b, 0x01000193) >>> 0;
      }
      id = h.toString(16).padStart(8, '0').repeat(4);
      await AsyncStorage.setItem(key, id);
    }
    this._targetId = id;
    this._targetUserId = userId;
    return id;
  },

  /** registers (or refreshes) the signed-in user's Appwrite push target */
  async syncTarget(): Promise<void> {
    const { user, status } = useAuthStore.getState();
    const token = this._token;
    if (
      !this.available ||
      status !== 'signed-in' ||
      !token ||
      !user ||
      !user.id
    ) {
      return;
    }
    try {
      const targetId = await this._ensureTargetId(user.id);
      // refresh: drop this user's stale target (old token) first
      await deletePushTarget(targetId);
      this.registered = await createPushTarget(targetId, token);
    } catch (e) {
      this.registered = false;
      console.warn('[push] target registration failed:', e);
    }
  },

  /** called after sign-in — registers this device for the user */
  onSignIn(): Promise<void> {
    return this.syncTarget();
  },

  /** called on sign-out — removes this device's push target */
  async onSignOut(): Promise<void> {
    this.registered = false;
    if (!this.available || !this._targetId) return;
    await deletePushTarget(this._targetId);
  },
};
