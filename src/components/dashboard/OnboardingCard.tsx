"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, PartyPopper, Table2, Upload, UserRound, X } from "lucide-react";
import { useSubjectsStore } from "@/lib/store/subjects";
import { useTimetableStore } from "@/lib/store/timetable";
import { usePortalStore } from "@/lib/store/portal";
import { useAuthStore } from "@/lib/store/auth";
import { useHydrated } from "@/lib/hooks";
import { getAuthHeaders } from "@/lib/auth/appwrite";
import { reconcilePortalSnapshot } from "@/lib/auth/sync";
import { syncPortalTestTasks } from "@/lib/portalTests";
import { EXAMPLE_TIMETABLE, parseTimetable } from "@/lib/timetable";
import type { PortalPlan } from "@/lib/server/portal";
import { cn } from "@/lib/utils";

/**
 * Setup wizard for a brand-new desk: three steps, each done the moment its
 * data exists. Shows only while the desk is empty; "Skip for now" persists.
 */

const DISMISS_KEY = "semester.onboarding.dismissed";

export default function OnboardingCard() {
  const hydrated = useHydrated();
  const subjects = useSubjectsStore((s) => s.subjects);
  const addSubject = useSubjectsStore((s) => s.addSubject);
  const entries = useTimetableStore((s) => s.entries);
  const setTimetable = useTimetableStore((s) => s.setTimetable);
  const portal = usePortalStore();
  const auth = useAuthStore();

  // read once lazily — the card only renders after hydration (see parent),
  // so localStorage is available and there is no server/client mismatch
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [timetableRaw, setTimetableRaw] = useState("");
  const [timetableMsg, setTimetableMsg] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [portalFetching, setPortalFetching] = useState(false);
  const [portalMsg, setPortalMsg] = useState("");

  const timetableDone = entries.length > 0;
  const subjectsDone = subjects.length > 0;
  const portalDone = Boolean(portal.username && portal.password && portal.data);
  const stepsDone = [timetableDone, subjectsDone, portalDone].filter(Boolean).length;

  const done = useMemo(
    () => ({
      timetable: timetableDone,
      subjects: subjectsDone,
      portal: portalDone,
    }),
    [timetableDone, subjectsDone, portalDone],
  );

  if (!hydrated || dismissed) return null;

  const formatTimetable = () => {
    try {
      const { entries: parsed } = parseTimetable(timetableRaw);
      setTimetable(parsed);
      setTimetableMsg("");
    } catch (e) {
      setTimetableMsg((e as Error).message);
    }
  };

  const addSubjectsFromInput = () => {
    // comma or newline separated — "Mathe, Englisch, Physik" in one go
    for (const name of subjectName.split(/[,\n]/)) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      if (!subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
        addSubject({ name: trimmed });
      }
    }
    setSubjectName("");
  };

  const fetchPortal = async () => {
    if (portalFetching) return;
    setPortalFetching(true);
    setPortalMsg("");
    try {
      const res = await fetch("/api/portal/fetch", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          baseUrl: portal.baseUrl,
          username: portal.username,
          password: portal.password,
        }),
      });
      const json = (await res.json().catch(() => null)) as PortalPlan | { error?: string } | null;
      if (!res.ok || !json || !("days" in json)) {
        setPortalMsg(
          json && "error" in json && json.error === "portal_auth"
            ? "The portal rejected the login. Check URL, email and password."
            : json && "error" in json && json.error === "auth_required"
              ? "Sign in first (sidebar) so the plan can sync."
              : "The portal could not be reached. You can do this later on the timetable page.",
        );
        return;
      }
      usePortalStore.getState().setData(json);
      void reconcilePortalSnapshot();
      syncPortalTestTasks(json.tests ?? []);
    } catch {
      setPortalMsg("The portal could not be reached. You can do this later on the timetable page.");
    } finally {
      setPortalFetching(false);
    }
  };

  const stepBadge = (isDone: boolean, n: number) => (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs",
        isDone ? "border-accent bg-accent text-paper" : "border-line text-ink-soft",
      )}
    >
      {isDone ? <Check className="size-3.5" strokeWidth={3} /> : n}
    </span>
  );

  return (
    <section className="rise card relative mb-10 overflow-hidden px-6 py-6">
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
          setDismissed(true);
        }}
        className="btn-icon absolute right-3 top-3"
        aria-label="Skip setup"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
          <PartyPopper className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Set up your desk</h2>
          <p className="font-mono text-[11px] text-ink-soft">
            {stepsDone === 3
              ? "all set, the desk fills itself from here"
              : `${stepsDone} of 3 done · everything saves automatically`}
          </p>
        </div>
      </div>

      <ol className="mt-5 space-y-5">
        {/* step 1 · timetable */}
        <li className="flex gap-4">
          {stepBadge(done.timetable, 1)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Your weekly timetable{" "}
              {done.timetable && <span className="font-mono text-[10px] text-accent uppercase">done</span>}
            </p>
            {!done.timetable && (
              <>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Paste the JSON below or{" "}
                  <Link href="/timetable" className="underline decoration-line hover:text-ink">
                    do it on the timetable page
                  </Link>
                  .
                </p>
                <textarea
                  value={timetableRaw}
                  onChange={(e) => setTimetableRaw(e.target.value)}
                  placeholder='[{ "day": "mon", "period": 1, "subject": "Mathematics" }, …]'
                  rows={3}
                  spellCheck={false}
                  className="field mt-2 resize-y font-mono text-xs"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button className="btn-primary px-4 py-1.5 text-xs" onClick={formatTimetable}>
                    <Upload className="size-3.5" /> Format timetable
                  </button>
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => setTimetableRaw(EXAMPLE_TIMETABLE)}
                  >
                    <Table2 className="size-3.5" /> Use example
                  </button>
                </div>
                {timetableMsg && <p className="mt-2 text-xs text-marker">{timetableMsg}</p>}
              </>
            )}
          </div>
        </li>

        {/* step 2 · subjects */}
        <li className="flex gap-4">
          {stepBadge(done.subjects, 2)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Your subjects{" "}
              {done.subjects && (
                <span className="font-mono text-[10px] text-accent uppercase">
                  {subjects.length} added
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Comma separated. Tasks, homework, grades and the calendar all share them.
            </p>
            {!done.subjects && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSubjectsFromInput()}
                  placeholder="Mathe, Englisch, Physik…"
                  className="field flex-1 py-1.5 text-sm"
                  aria-label="Subject names, comma separated"
                />
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={addSubjectsFromInput}>
                  Add
                </button>
              </div>
            )}
          </div>
        </li>

        {/* step 3 · school portal */}
        <li className="flex gap-4">
          {stepBadge(done.portal, 3)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              School portal{" "}
              {done.portal && <span className="font-mono text-[10px] text-accent uppercase">done</span>}
              {!done.portal && !auth.user && auth.status === "signed-out" && (
                <span className="ml-2 inline-flex items-center gap-1 font-mono text-[10px] text-ink-soft normal-case">
                  <UserRound className="size-3" /> sign-in needed for sync
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              Optional: substitutions and upcoming tests flow in automatically. Credentials stay on
              this device.
            </p>
            {!done.portal && (
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  value={portal.baseUrl}
                  onChange={(e) =>
                    usePortalStore.getState().setSettings({ ...usePortalStore.getState(), baseUrl: e.target.value })
                  }
                  placeholder="https://….eltern-portal.org"
                  className="field py-1.5 text-xs"
                  aria-label="Portal URL"
                  autoCapitalize="none"
                />
                <input
                  value={portal.username}
                  onChange={(e) =>
                    usePortalStore.getState().setSettings({ ...usePortalStore.getState(), username: e.target.value })
                  }
                  placeholder="Portal email"
                  className="field py-1.5 text-xs"
                  aria-label="Portal email"
                  autoCapitalize="none"
                  type="email"
                />
                <input
                  value={portal.password}
                  onChange={(e) =>
                    usePortalStore.getState().setSettings({ ...usePortalStore.getState(), password: e.target.value })
                  }
                  placeholder="Portal password"
                  className="field py-1.5 text-xs"
                  aria-label="Portal password"
                  type="password"
                />
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => void fetchPortal()}
                  disabled={portalFetching || !portal.baseUrl || !portal.username || !portal.password}
                >
                  {portalFetching ? "Fetching…" : "Connect"}
                </button>
              </div>
            )}
            {portalMsg && <p className="mt-2 text-xs text-marker">{portalMsg}</p>}
            {portal.error && !portalMsg && <p className="mt-2 text-xs text-marker">{portal.error}</p>}
          </div>
        </li>
      </ol>
    </section>
  );
}
