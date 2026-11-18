/* The two encryption moments — port of the web `EncryptionGate.tsx`:
 *  · a brand-new key: the recovery code is shown once (a forgotten password
 *    plus a lost code means the cloud copy can never be opened)
 *  · a locked key: sync is paused until the password or recovery code opens it
 * Local data stays usable while locked; only the cloud round-trip waits. */

import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { syncNow } from '../lib/sync';
import { useAuthStore } from '../stores/auth_store';
import {
  unlockWithPassword,
  unlockWithRecoveryKey,
  useKeyringStore,
} from '../lib/crypto/keyring';
import { useSem } from '../theme/theme';
import { SemGhostButton, SemLabel, SemPrimaryButton, SemSheet, SemTextField } from './controls';

/** lets any screen reopen the dismissed unlock prompt ("Unlock encrypted
 * sync" in the account panel) without prop-drilling through the tree */
let openGate: (() => void) | null = null;

export function openEncryptionGate(): void {
  openGate?.();
}

export function EncryptionGate(): React.JSX.Element | null {
  const { c, t } = useSem();
  const signedIn = useAuthStore((s) => s.status === 'signed-in');
  const status = useKeyringStore((s) => s.status);
  const recoveryKey = useKeyringStore((s) => s.recoveryKey);
  const setKeyring = useKeyringStore((s) => s.setState);

  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status === 'unlocked') setDismissed(false);
  }, [status]);

  useEffect(() => {
    openGate = () => setDismissed(false);
    return () => {
      openGate = null;
    };
  }, []);

  // sign-out leaves nothing to unlock
  useEffect(() => {
    if (!signedIn) {
      setSecret('');
      setError('');
      setDismissed(false);
    }
  }, [signedIn]);

  if (!signedIn) return null;

  const locked = status === 'locked';
  const sheetOpen = Boolean(recoveryKey) || (locked && !dismissed);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'password') await unlockWithPassword(secret);
      else await unlockWithRecoveryKey(secret);
      setSecret('');
      setDismissed(false);
      await syncNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {locked && dismissed ? (
        <SemGhostButton
          onPress={() => setDismissed(false)}
          style={{ position: 'absolute', right: 16, bottom: 96 }}
        >
          🔒 Unlock encrypted sync
        </SemGhostButton>
      ) : null}

      <SemSheet
        visible={sheetOpen}
        title={recoveryKey ? 'Your recovery key' : 'Unlock encrypted sync'}
        // the recovery code is shown once — no dismissal before it is saved
        onClose={() => {
          if (recoveryKey) return;
          setDismissed(true);
        }}
      >
        {recoveryKey ? (
          <View style={{ gap: 14 }}>
            <Text style={[t.bodyMedium, { color: c.inkSoft, lineHeight: 21 }]}>
              Your notes, tasks and study-room content are encrypted on this device before they
              reach the cloud. Save this recovery key somewhere safe — it is the only way back into
              your data if you forget your password.
            </Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 14,
                padding: 12,
                backgroundColor: c.paperDeep ?? c.card,
              }}
            >
              <Text
                selectable
                style={[
                  t.bodyMedium,
                  { fontFamily: 'IBM Plex Mono', fontSize: 12, letterSpacing: 0.5, lineHeight: 20 },
                ]}
              >
                {recoveryKey}
              </Text>
            </View>
            <SemGhostButton onPress={() => setSaved(true)}>
              {saved ? '✓ Stored elsewhere' : 'I stored this key somewhere safe'}
            </SemGhostButton>
            <SemPrimaryButton
              disabled={!saved}
              onPress={() => setKeyring({ recoveryKey: null })}
            >
              Done
            </SemPrimaryButton>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ gap: 14 }}>
              <Text style={[t.bodyMedium, { color: c.inkSoft, lineHeight: 21 }]}>
                Sync is paused because this device does not hold your data key. Your local data is
                still here. Open it with your password, or with the recovery key you saved.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SemGhostButton
                  onPress={() => {
                    setMode('password');
                    setSecret('');
                    setError('');
                  }}
                  border={mode === 'password' ? c.accent : c.line}
                  style={{ flex: 1 }}
                >
                  Password
                </SemGhostButton>
                <SemGhostButton
                  onPress={() => {
                    setMode('recovery');
                    setSecret('');
                    setError('');
                  }}
                  border={mode === 'recovery' ? c.accent : c.line}
                  style={{ flex: 1 }}
                >
                  Recovery key
                </SemGhostButton>
              </View>

              <View style={{ gap: 6 }}>
                <SemLabel text={mode === 'password' ? 'Account password' : 'Recovery key'} />
                <SemTextField
                  value={secret}
                  onChangeText={setSecret}
                  secureTextEntry={mode === 'password'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={mode === 'password' ? '••••••••' : 'XXXXX XXXXX XXXXX …'}
                />
              </View>

              {error ? (
                <Text style={[t.bodySmall, { color: '#b3261e' }]}>{error}</Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <SemGhostButton onPress={() => setDismissed(true)} style={{ flex: 1 }}>
                  Not now
                </SemGhostButton>
                <SemPrimaryButton
                  onPress={submit}
                  disabled={busy || secret.length === 0}
                  style={{ flex: 1 }}
                >
                  {busy ? 'Unlocking…' : 'Unlock'}
                </SemPrimaryButton>
              </View>
            </View>
          </ScrollView>
        )}
      </SemSheet>
    </>
  );
}
