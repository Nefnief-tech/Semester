import { account } from "./appwrite";

/**
 * Account prefs are written as a whole object, so two concurrent writers each
 * send their own snapshot and the later call silently drops the other's key —
 * the wrapped data key being one of them, which would be unrecoverable.
 * Every prefs write goes through this one queue: read, merge, write.
 */
let queue: Promise<unknown> = Promise.resolve();

export function updatePrefsMerged(patch: Record<string, unknown>): Promise<void> {
  const run = queue.then(async () => {
    if (!account) throw new Error("Auth is not configured");
    const prefs = (await account.getPrefs()) as Record<string, unknown>;
    await account.updatePrefs({ ...prefs, ...patch });
  });
  queue = run.catch(() => {});
  return run;
}
