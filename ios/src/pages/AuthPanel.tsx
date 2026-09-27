/* Port of AuthModal.tsx via `auth_sheet.dart` — sign in / create account /
 * account management, plus the device-local server URL setting, push status,
 * email verification, password recovery and two-factor authentication.
 * Embedded by the Settings page. */

import React, { useEffect, useState } from 'react';
import { Pressable as RNPressable, Text, View } from 'react-native';

import {
  MfaRequiredError,
  cancelMfaSignIn,
  confirmMfaSignIn,
  getOrCreateRecoveryCodes,
  refreshUser,
  setMfaEnabled,
  signIn,
  signOut,
  signUp,
  startMfaChallenge,
  syncNow,
  requestRecovery,
  sendVerification,
} from '../lib/sync';
import { PushService } from '../lib/push';
import { useAuthStore } from '../stores/auth_store';
import { useSettingsStore } from '../stores/settings_store';
import { SegToggle, SemGhostButton, SemLabel, SemPrimaryButton, SemTextField } from '../components/controls';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import { formatClock } from '../utils/utils';

export function AuthPanel(): React.JSX.Element {
  const auth = useAuthStore();
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const { c, t } = useSem();

  const [register, setRegister] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // two-factor sign-in step
  const [mfaStepActive, setMfaStepActive] = useState(false);
  const [mfaEmailFactor, setMfaEmailFactor] = useState(true);
  const [mfaTotpFactor, setMfaTotpFactor] = useState(false);
  const [mfaFactor, setMfaFactor] = useState('email');
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaSending, setMfaSending] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaStepError, setMfaStepError] = useState('');

  // two-factor setup (signed in)
  const [mfaSetupBusy, setMfaSetupBusy] = useState(false);
  const [mfaDisableConfirm, setMfaDisableConfirm] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mfaSetupError, setMfaSetupError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverDraft, setServerDraft] = useState(serverUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [obscure, setObscure] = useState(true);

  // a verification confirmed in the phone's browser (or elsewhere) should
  // show up the moment the panel opens
  useEffect(() => {
    void refreshUser();
  }, []);

  const friendlyAuthError = (raw: string): string => {
    if (raw.includes('user_invalid_credentials') || raw.includes('invalid_credentials')) return 'Wrong email or password.';
    if (raw.includes('password_too_short') || raw.includes('password_min_length')) return 'Password must be at least 8 characters.';
    if (raw.includes('user_already_exists') || raw.includes('email_already_exists')) return 'An account with this email already exists.';
    if (raw.includes('user_not_found')) return 'No account with this email.';
    if (raw.includes('already_verified') || raw.includes('already')) return 'This email is already verified.';
    if (raw.includes('invalid_token') || raw.includes('expired')) return 'This link is invalid or has expired. Request a new one.';
    if (raw.includes('rate_limit') || raw.includes('rate')) return 'Too many requests — wait a minute and try again.';
    if (raw.includes('smtp') || raw.includes('mail')) return "The mail server isn't configured for this project yet.";
    return raw.length > 200 ? raw.slice(0, 200) : raw;
  };

  const friendlyMfaError = (raw: string): string => {
    if (raw.includes('rate')) return 'Too many attempts — wait a minute and try again.';
    if (raw.includes('challenge') || raw.includes('expired')) return 'This code request ran out — send a new one.';
    if (raw.includes('invalid') || raw.includes('token') || raw.includes('credentials'))
      return "That code isn't right — check the newest email (or recovery code) and try again.";
    if (raw.includes('smtp')) return "The mail server isn't configured for this project yet.";
    return raw.length > 200 ? raw.slice(0, 200) : raw;
  };

  const sendVerificationMail = async () => {
    setVerifyError('');
    setVerifyBusy(true);
    try {
      await sendVerification();
      setVerifySent(true);
    } catch (e) {
      setVerifyError(friendlyAuthError(String(e)));
    } finally {
      setVerifyBusy(false);
    }
  };

  const sendRecoveryMail = async () => {
    setRecoveryError('');
    setRecoveryBusy(true);
    try {
      await requestRecovery(email.trim());
      setRecoverySent(true);
    } catch (e) {
      setRecoveryError(friendlyAuthError(String(e)));
    } finally {
      setRecoveryBusy(false);
    }
  };

  // ---- two-factor sign-in step ----

  const startChallenge = async (factor: string) => {
    setMfaSending(true);
    try {
      const id = await startMfaChallenge(factor);
      setMfaChallengeId(id);
    } catch (e) {
      setMfaStepError(friendlyMfaError(String(e)));
    } finally {
      setMfaSending(false);
    }
  };

  const enterMfaStep = (e: MfaRequiredError) => {
    setMfaStepActive(true);
    setMfaEmailFactor(e.emailFactor);
    setMfaTotpFactor(e.totpFactor);
    const factor = e.totpFactor ? 'totp' : 'email';
    setMfaFactor(factor);
    setMfaChallengeId(null);
    setMfaCode('');
    setMfaStepError('');
    void startChallenge(factor);
  };

  const switchMfaFactor = (f: string) => {
    if (f === mfaFactor) return;
    setMfaFactor(f);
    setMfaChallengeId(null);
    setMfaCode('');
    setMfaStepError('');
    if (f !== 'recoverycode') void startChallenge(f);
  };

  const confirmMfa = async () => {
    if (!mfaChallengeId) return;
    setMfaStepError('');
    setMfaBusy(true);
    try {
      await confirmMfaSignIn(mfaChallengeId, mfaCode.trim());
      setMfaStepActive(false);
    } catch (e) {
      setMfaStepError(friendlyMfaError(String(e)));
    } finally {
      setMfaBusy(false);
    }
  };

  // ---- two-factor setup (signed in) ----

  const enableMfa = async () => {
    setMfaSetupError('');
    setMfaSetupBusy(true);
    try {
      await setMfaEnabled(true);
      const codes = await getOrCreateRecoveryCodes();
      setRecoveryCodes(codes);
    } catch (e) {
      setMfaSetupError(friendlyAuthError(String(e)));
    } finally {
      setMfaSetupBusy(false);
    }
  };

  const disableMfa = async () => {
    setMfaSetupError('');
    setMfaSetupBusy(true);
    try {
      await setMfaEnabled(false);
      setMfaDisableConfirm(false);
    } catch (e) {
      setMfaSetupError(friendlyAuthError(String(e)));
    } finally {
      setMfaSetupBusy(false);
    }
  };

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (register) {
        await signUp(name.trim(), email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      await PushService.onSignIn();
      setPassword('');
      setMfaStepActive(false);
    } catch (e) {
      if (e instanceof MfaRequiredError) {
        setPassword('');
        enterMfaStep(e);
      } else {
        setError(friendlyAuthError(String(e)));
      }
    } finally {
      setBusy(false);
    }
  };

  const signOutNow = async () => {
    await PushService.onSignOut();
    await signOut();
  };

  const signedInNow = auth.status === 'signed-in' && auth.user != null;
  const user = auth.user;

  const spinner = <Text style={{ color: c.inkSoft }}>…</Text>;

  return (
    <View>
      {auth.status === 'loading' ? (
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ color: c.inkSoft }}>Checking session…</Text>
        </View>
      ) : null}

      {signedInNow && user ? (
        <>
          <View
            style={{
              padding: 12,
              backgroundColor: c.paper,
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="person" size={16} color={c.accent} />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[t.bodyMedium, { fontWeight: '500' }]}>
                {user.name}
              </Text>
              <Text numberOfLines={1} style={t.labelSmall}>
                {user.email}
              </Text>
            </View>
          </View>
          <View style={{ height: 10 }} />
          <Text style={t.labelSmall}>
            {auth.syncing
              ? 'syncing…'
              : auth.syncError
                ? `sync error · ${auth.syncError}`
                : auth.lastSyncedAt
                  ? `synced · ${formatClock(auth.lastSyncedAt)}`
                  : 'not synced yet'}
          </Text>
          {!user.emailVerified ? (
            <>
              <View style={{ height: 4 }} />
              <Text style={[t.labelSmall, { color: c.amber }]}>email · not verified yet</Text>
              <View style={{ height: 10 }} />
              <View style={{ alignItems: 'flex-start' }}>
                <SemGhostButton disabled={verifyBusy} onPress={() => void sendVerificationMail()}>
                  {verifyBusy ? (
                    spinner
                  ) : (
                    <>
                      <Icon name="mark_email_read" size={16} />
                      <View style={{ width: 6 }} />
                      <Text style={t.bodyMedium}>Send verification email</Text>
                    </>
                  )}
                </SemGhostButton>
              </View>
              {verifySent ? (
                <>
                  <View style={{ height: 6 }} />
                  <Text style={[t.labelSmall, { color: c.accent }]}>
                    sent — follow the link in your inbox (valid 7 days)
                  </Text>
                </>
              ) : null}
              {verifyError ? (
                <>
                  <View style={{ height: 6 }} />
                  <Text style={{ color: c.marker, fontSize: 13 }}>{verifyError}</Text>
                </>
              ) : null}
            </>
          ) : (
            <>
              <View style={{ height: 4 }} />
              <Text style={[t.labelSmall, { color: c.accent }]}>email · verified</Text>
            </>
          )}
          <View style={{ height: 12 }} />
          <View style={{ padding: 12, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[t.labelSmall, { color: c.inkSoft, letterSpacing: 1.2, flex: 1 }]}>TWO-FACTOR VIA EMAIL</Text>
              <Icon
                name={user.mfa ? 'verified_user' : 'gpp_maybe'}
                size={16}
                color={user.mfa ? c.accent : c.inkSoft}
              />
            </View>
            <View style={{ height: 8 }} />
            {!user.mfa && !mfaDisableConfirm ? (
              <View style={{ alignItems: 'flex-start' }}>
                <SemGhostButton disabled={mfaSetupBusy} onPress={() => void enableMfa()}>
                  {mfaSetupBusy ? (
                    spinner
                  ) : (
                    <>
                      <Icon name="verified_user" size={16} />
                      <View style={{ width: 6 }} />
                      <Text style={t.bodyMedium}>Enable 2FA</Text>
                    </>
                  )}
                </SemGhostButton>
              </View>
            ) : null}
            {user.mfa && !mfaDisableConfirm ? (
              <View style={{ alignItems: 'flex-start' }}>
                <SemGhostButton
                  disabled={mfaSetupBusy}
                  foreground={c.marker}
                  border={`${c.marker}66`}
                  onPress={() => setMfaDisableConfirm(true)}
                >
                  <>
                    <Icon name="gpp_bad" size={16} color={c.marker} />
                    <View style={{ width: 6 }} />
                    <Text style={[t.bodyMedium, { color: c.marker }]}>Disable 2FA</Text>
                  </>
                </SemGhostButton>
              </View>
            ) : null}
            {mfaDisableConfirm && !mfaSetupBusy ? (
              <Text style={[t.labelSmall, { lineHeight: 15 }]}>
                Turn off two-factor? You'll sign in with just the password again. This cannot be undone from here
                without re-enabling.
              </Text>
            ) : null}
            {mfaDisableConfirm ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 6 }}>
                <RNPressable onPress={() => void disableMfa()}>
                  <Text style={{ color: c.marker, fontSize: 12 }}>Yes, disable</Text>
                </RNPressable>
                <RNPressable onPress={() => setMfaDisableConfirm(false)}>
                  <Text style={{ fontSize: 12, color: c.ink }}>keep it on</Text>
                </RNPressable>
              </View>
            ) : null}
            {mfaSetupError ? <Text style={{ color: c.marker, fontSize: 13 }}>{mfaSetupError}</Text> : null}
            {!user.mfa ? (
              <>
                <View style={{ height: 4 }} />
                <Text style={[t.labelSmall, { lineHeight: 15 }]}>
                  asks for an emailed code at every sign-in · needs a verified email
                </Text>
              </>
            ) : null}
          </View>
          {recoveryCodes ? (
            <>
              <View style={{ height: 12 }} />
              <View
                style={{
                  padding: 12,
                  backgroundColor: c.paper,
                  borderWidth: 1,
                  borderColor: `${c.accent}80`,
                  borderRadius: 12,
                }}
              >
                <Text style={[t.labelSmall, { lineHeight: 15 }]}>
                  Two-factor is on. Save these recovery codes — each works once instead of an emailed code, and they
                  are the only way back if you lose access to your inbox.
                </Text>
                <View style={{ height: 8 }} />
                <View style={{ padding: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 8 }}>
                  {recoveryCodes.map((code) => (
                    <Text key={code} style={[t.labelSmall, { fontFamily: 'IBM Plex Mono' }]}>
                      {code}
                    </Text>
                  ))}
                </View>
                <View style={{ height: 8 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <SemGhostButton onPress={() => void 0}>
                      <Icon name="copy" size={16} />
                      <View style={{ width: 6 }} />
                      <Text style={t.bodyMedium}>Copy</Text>
                    </SemGhostButton>
                  </View>
                  <View style={{ flex: 1 }}>
                    <SemPrimaryButton onPress={() => setRecoveryCodes(null)}>Done</SemPrimaryButton>
                  </View>
                </View>
              </View>
            </>
          ) : null}
          {PushService.available ? (
            <>
              <View style={{ height: 4 }} />
              <Text style={t.labelSmall}>
                {PushService.registered ? 'push · ready (Appwrite Messaging)' : 'push · not registered on this device'}
              </Text>
            </>
          ) : null}
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SemGhostButton
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  await syncNow();
                  setBusy(false);
                }}
              >
                {busy ? (
                  spinner
                ) : (
                  <>
                    <Icon name="refresh" size={16} />
                    <View style={{ width: 6 }} />
                    <Text style={t.bodyMedium}>Sync now</Text>
                  </>
                )}
              </SemGhostButton>
            </View>
            <View style={{ flex: 1 }}>
              <SemGhostButton foreground={c.marker} border={`${c.marker}66`} onPress={() => void signOutNow()}>
                <>
                  <Icon name="logout" size={16} color={c.marker} />
                  <View style={{ width: 6 }} />
                  <Text style={[t.bodyMedium, { color: c.marker }]}>Sign out</Text>
                </>
              </SemGhostButton>
            </View>
          </View>
          <View style={{ height: 8 }} />
          <Text style={t.labelSmall}>Signing out keeps your data on this device.</Text>
        </>
      ) : null}

      {!signedInNow && auth.status !== 'loading' && mfaStepActive ? (
        <>
          <Text style={[t.titleMedium, { fontWeight: '600' }]}>Two-factor</Text>
          <View style={{ height: 6 }} />
          <Text style={[t.labelSmall, { lineHeight: 15 }]}>
            {mfaFactor === 'email'
              ? 'We sent a code to your email — it expires in 15 minutes.'
              : mfaFactor === 'totp'
                ? 'Use your authenticator app to continue.'
                : 'Use one of the recovery codes you saved when enabling 2FA.'}
          </Text>
          {mfaFactor === 'email' && !mfaChallengeId ? (
            <>
              <View style={{ height: 8 }} />
              <Text style={t.labelSmall}>
                {mfaSending ? 'sending the code…' : 'the code could not be sent — try resending'}
              </Text>
            </>
          ) : null}
          <View style={{ height: 14 }} />
          <SemLabel text="Code" />
          <View style={{ height: 6 }} />
          <SemTextField
            value={mfaCode}
            keyboardType={mfaFactor === 'recoverycode' ? 'default' : 'number-pad'}
            autoCapitalize="none"
            onChangeText={setMfaCode}
            onSubmitEditing={() => void confirmMfa()}
          />
          <View style={{ height: 12 }} />
          {mfaStepError ? <Text style={{ color: c.marker, fontSize: 13 }}>{mfaStepError}</Text> : null}
          <View style={{ height: 12 }} />
          <SemPrimaryButton disabled={mfaBusy || !mfaChallengeId} onPress={() => void confirmMfa()}>
            {mfaBusy ? spinner : 'Verify code'}
          </SemPrimaryButton>
          <View style={{ height: 4 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <TextLink
              label="back to sign in"
              onPress={async () => {
                await cancelMfaSignIn();
                setMfaStepActive(false);
                setMfaChallengeId(null);
                setMfaCode('');
              }}
            />
            {mfaFactor !== 'email' && mfaEmailFactor ? (
              <TextLink label="email code" onPress={() => switchMfaFactor('email')} />
            ) : null}
            {mfaFactor !== 'totp' && mfaTotpFactor ? (
              <TextLink label="authenticator" onPress={() => switchMfaFactor('totp')} />
            ) : null}
            {mfaFactor !== 'recoverycode' ? (
              <TextLink label="recovery code" onPress={() => switchMfaFactor('recoverycode')} />
            ) : null}
            {mfaFactor === 'email' && mfaChallengeId ? (
              <TextLink
                label="resend"
                onPress={() => {
                  setMfaStepError('');
                  void startChallenge('email');
                }}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {!signedInNow && auth.status !== 'loading' && !mfaStepActive ? (
        recovery ? (
          <>
            <Text style={[t.titleMedium, { fontWeight: '600' }]}>Forgot your password?</Text>
            <View style={{ height: 6 }} />
            <Text style={[t.labelSmall, { lineHeight: 15 }]}>
              We'll send a reset link to your email. It opens on any device — the new password is set in the browser.
            </Text>
            <View style={{ height: 14 }} />
            <SemLabel text="Email" />
            <View style={{ height: 6 }} />
            <SemTextField
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@school.example"
              onChangeText={setEmail}
              onSubmitEditing={() => void sendRecoveryMail()}
            />
            {recoverySent ? (
              <>
                <View style={{ height: 8 }} />
                <Text style={[t.labelSmall, { color: c.accent }]}>recovery email sent — valid for 1 hour</Text>
              </>
            ) : null}
            {recoveryError ? (
              <>
                <View style={{ height: 8 }} />
                <Text style={{ color: c.marker, fontSize: 13 }}>{recoveryError}</Text>
              </>
            ) : null}
            <View style={{ height: 16 }} />
            <SemPrimaryButton disabled={recoveryBusy} onPress={() => void sendRecoveryMail()}>
              {recoveryBusy ? spinner : 'Send recovery link'}
            </SemPrimaryButton>
            <View style={{ height: 4 }} />
            <TextLink
              label="Back to sign in"
              onPress={() => {
                setRecovery(false);
                setRecoverySent(false);
                setRecoveryError('');
              }}
            />
          </>
        ) : (
          <>
            <SegToggle<boolean>
              options={[
                [false, 'Sign in'],
                [true, 'Create account'],
              ]}
              selected={register}
              onChanged={(v) => {
                setRegister(v);
                setError('');
              }}
            />
            <View style={{ height: 14 }} />
            {register ? (
              <>
                <SemLabel text="Name" />
                <View style={{ height: 6 }} />
                <SemTextField value={name} placeholder="Your name" onChangeText={setName} />
                <View style={{ height: 12 }} />
              </>
            ) : null}
            <SemLabel text="Email" />
            <View style={{ height: 6 }} />
            <SemTextField
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@school.example"
              onChangeText={setEmail}
            />
            <View style={{ height: 12 }} />
            <SemLabel text="Password" />
            <View style={{ height: 6 }} />
            <SemTextField
              value={password}
              secureTextEntry={obscure}
              placeholder={register ? 'at least 8 characters' : ''}
              onChangeText={setPassword}
              onSubmitEditing={() => void submit()}
              suffix={
                <RNPressable onPress={() => setObscure(!obscure)} hitSlop={8} style={{ padding: 4 }}>
                  <Icon name={obscure ? 'visibility' : 'visibility_off'} size={18} color={c.inkSoft} />
                </RNPressable>
              }
            />
            {!register ? (
              <View style={{ alignItems: 'flex-start', paddingTop: 4 }}>
                <TextLink
                  label="Forgot password?"
                  onPress={() => {
                    setRecovery(true);
                    setRecoverySent(false);
                    setRecoveryError('');
                  }}
                />
              </View>
            ) : null}
            {error ? (
              <>
                <View style={{ height: 8 }} />
                <Text style={{ color: c.marker, fontSize: 13 }}>{error}</Text>
              </>
            ) : null}
            <View style={{ height: 16 }} />
            <SemPrimaryButton disabled={busy} onPress={() => void submit()}>
              {busy ? spinner : register ? 'Create account & sign in' : 'Sign in'}
            </SemPrimaryButton>
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Icon name="cloud_off" size={12} color={c.inkSoft} />
              <View style={{ width: 6 }} />
              <Text style={[t.labelSmall, { lineHeight: 15, flex: 1 }]}>
                Authenticated by your Appwrite project — the password never touches the Semester server. Sessions are
                managed by Appwrite.
              </Text>
            </View>
          </>
        )
      ) : null}

      <View style={{ height: 20 }} />
      <View style={{ height: 1, backgroundColor: c.line }} />
      <View style={{ height: 14 }} />
      <SemLabel text="Semester server (AI + Vertretungsplan)" />
      <View style={{ height: 6 }} />
      <SemTextField
        value={serverDraft}
        keyboardType="url"
        autoCapitalize="none"
        placeholder="https://your-semester-server:8899"
        onChangeText={setServerDraft}
        onSubmitEditing={() => setServerUrl(serverDraft)}
        onEndEditing={() => setServerUrl(serverDraft)}
      />
      <View style={{ paddingTop: 6 }}>
        <Text style={[t.labelSmall, { lineHeight: 15 }]}>
          localhost = your Mac in the iOS simulator. Same server as the web app.
        </Text>
      </View>
    </View>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c, t } = useSem();
  return (
    <RNPressable onPress={onPress} hitSlop={6}>
      <Text style={[t.labelSmall, { color: c.inkSoft }]}>{label}</Text>
    </RNPressable>
  );
}
