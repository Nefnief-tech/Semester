"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Lock, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { syncNow } from "@/lib/auth/sync";
import { useAuthStore } from "@/lib/store/auth";
import {
  unlockWithPassword,
  unlockWithRecoveryKey,
  useKeyringStore,
} from "@/lib/crypto/keyring";

/**
 * Two moments need a dialog:
 *  - a brand-new key: the recovery code is shown once, because a forgotten
 *    password plus a lost code means the cloud copy can never be opened
 *  - a locked key: sync paused until the password (or recovery code) opens it
 * Local data stays usable while locked; only the cloud round-trip waits.
 */
export default function EncryptionGate() {
  const signedIn = useAuthStore((s) => s.status === "signed-in");
  const status = useKeyringStore((s) => s.status);
  const recoveryKey = useKeyringStore((s) => s.recoveryKey);
  const setKeyring = useKeyringStore((s) => s.setState);

  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status === "unlocked") setDismissed(false);
  }, [status]);

  const locked = signedIn && status === "locked";
  const open = Boolean(recoveryKey) || (locked && !dismissed);

  const copy = async () => {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the code is selectable in the box above
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "password") await unlockWithPassword(secret);
      else await unlockWithRecoveryKey(secret);
      setSecret("");
      setDismissed(false);
      await syncNow();
    } catch (err) {
      setError((err as Error).message || "Could not unlock.");
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) return null;

  return (
    <>
      {locked && dismissed && (
        <button
          onClick={() => setDismissed(false)}
          className="fixed right-4 bottom-4 z-40 flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 text-xs font-medium shadow-lg transition-colors hover:bg-ink/5"
        >
          <Lock className="size-3.5 text-amber" />
          Unlock encrypted sync
        </button>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (recoveryKey) return; // must be acknowledged — shown only once
          setDismissed(true);
        }}
        title={recoveryKey ? "Your recovery key" : "Unlock encrypted sync"}
      >
        {recoveryKey ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              Your notes, tasks and study-room content are encrypted on this device before they
              reach the cloud. Save this recovery key somewhere safe — it is the only way back
              into your data if you forget your password.
            </p>
            <div className="flex items-start gap-2 rounded-xl border border-line bg-paper p-3">
              <code className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed break-words select-all">
                {recoveryKey}
              </code>
              <button
                onClick={copy}
                className="btn-icon shrink-0"
                aria-label="Copy recovery key"
                title="Copy"
              >
                {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
              </button>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              I stored this key somewhere other than this device.
            </label>
            <button
              disabled={!saved}
              onClick={() => setKeyring({ recoveryKey: null })}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShieldCheck className="size-4" /> Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              Sync is paused because this device does not hold your data key. Your local data is
              still here. Open it with your password, or with the recovery key you saved.
            </p>
            <div className="flex gap-1 rounded-xl border border-line bg-paper p-1">
              {(["password", "recovery"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setSecret("");
                    setError("");
                  }}
                  className={`flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === m ? "bg-ink/10 text-ink" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {m === "password" ? "Password" : "Recovery key"}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="label">
                {mode === "password" ? "Account password" : "Recovery key"}
              </span>
              <input
                autoFocus
                type={mode === "password" ? "password" : "text"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="field w-full font-mono text-xs"
                placeholder={mode === "password" ? "••••••••" : "XXXXX XXXXX XXXXX …"}
              />
            </label>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="btn-ghost flex-1"
              >
                Not now
              </button>
              <button type="submit" disabled={busy || !secret} className="btn-primary flex-1">
                <KeyRound className="size-4" /> {busy ? "Unlocking…" : "Unlock"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
