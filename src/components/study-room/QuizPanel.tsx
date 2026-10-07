"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, CircleHelp, ListChecks, RotateCcw, X } from "lucide-react";
import { cn, summarizeProviderError } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth/appwrite";
import { useAuthStore } from "@/lib/store/auth";
import { useT } from "@/lib/i18n";
import { useStudyRoomStore } from "@/lib/store/studyroom";
import { EmptyState } from "@/components/ui/bits";
import SetupNotice from "@/components/study-room/SetupNotice";
import AuthRequiredNotice from "@/components/study-room/AuthRequiredNotice";

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
}

/**
 * AI quiz mode: generates a multiple-choice quiz from the ticked documents,
 * then runs it as an interactive session with instant feedback, a score and
 * a review. Sessions are intentionally local — a quiz is practice, not data.
 */
export default function QuizPanel({ configured }: { configured: boolean }) {
  const t = useT();
  const documents = useStudyRoomStore((s) => s.documents);
  const selectedDocIds = useStudyRoomStore((s) => s.selectedDocIds);

  // all hooks before the early returns (configured flips after the page fetch)
  const signedIn = useAuthStore((s) => s.status) === "signed-in";

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Array<{ correct: boolean; chosen: number }>>([]);
  const [done, setDone] = useState(false);

  const score = useMemo(() => answers.filter((a) => a.correct).length, [answers]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/study-room/quiz", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ documentIds: selectedDocIds }),
      });
      const json = (await res.json().catch(() => null)) as
        | { questions?: QuizQuestion[] }
        | { error?: string; detail?: string }
        | null;
      if (!res.ok || !json || !("questions" in json) || !json.questions?.length) {
        const code = json && "error" in json ? json.error : "generation_failed";
        const detail = summarizeProviderError(json && "detail" in json ? json.detail : undefined);
        setError(
          code === "not_configured"
            ? "Add an API key to .env.local first (see the setup note)."
            : code === "auth_required"
              ? "Sign in first: use “Sign in to sync” in the sidebar."
              : code === "ai_locked"
                ? "AI access is member-only right now. Ask the admin to add you to the AI team."
                : detail
                  ? `The AI provider rejected the request: ${detail}`
                  : "The AI didn't return a usable quiz. Try again or pick different documents.",
        );
        return;
      }
      setQuestions(json.questions);
      setPos(0);
      setChosen(null);
      setAnswers([]);
      setDone(false);
    } catch {
      setError("Could not reach the AI provider.");
    } finally {
      setGenerating(false);
    }
  };

  if (!configured) return <SetupNotice kind="chat" />;
  if (!signedIn) return <AuthRequiredNotice feature={t("take quizzes")} />;

  if (questions === null) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title={t("No quiz yet")}
          hint={
            selectedDocIds.length > 0
              ? t("Turn your ticked documents into a multiple-choice quiz and test yourself.")
              : t("Upload material first and tick it as AI context, then generate a quiz.")
          }
          action={
            <button
              className="btn-primary"
              onClick={() => void generate()}
              disabled={generating || selectedDocIds.length === 0}
            >
              <ListChecks className="size-4" />
              {generating
                ? "Writing questions…"
                : `Generate from ${selectedDocIds.length} ${selectedDocIds.length === 1 ? "document" : "documents"}`}
            </button>
          }
        />
        {error && <p className="text-center text-sm text-marker">{error}</p>}
      </div>
    );
  }

  /* ---------- session complete: score + review ---------- */
  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card flex flex-col items-center px-6 py-8 text-center">
          <span
            className={cn(
              "grid size-14 place-items-center rounded-full border font-display text-xl font-semibold",
              pct >= 80
                ? "border-accent/50 bg-accent-soft text-accent"
                : pct >= 50
                  ? "border-amber/50 bg-amber/10 text-amber"
                  : "border-marker/50 bg-marker/10 text-marker",
            )}
          >
            {pct}%
          </span>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {score} of {questions.length} correct
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {pct >= 80
              ? "Solid. The material sits."
              : pct >= 50
                ? "Halfway there. Review the misses and run it again."
                : "Worth another pass through the material before retesting."}
          </p>
        </div>

        <h3 className="mb-2 mt-6 font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
          review
        </h3>
        <ul className="space-y-2">
          {questions.map((q, i) => {
            const a = answers[i];
            return (
              <li key={i} className="card px-4 py-3">
                <p className="flex items-start gap-2 text-sm font-medium">
                  {a?.correct ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={3} />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-marker" strokeWidth={3} />
                  )}
                  {q.question}
                </p>
                <p className="mt-1.5 text-xs text-ink-soft">
                  your answer:{" "}
                  <span className={cn("font-medium", a?.correct ? "text-accent" : "text-marker")}>
                    {a ? q.options[a.chosen] : "skipped"}
                  </span>
                  {!a?.correct && (
                    <>
                      {" · "}correct:{" "}
                      <span className="font-medium text-accent">{q.options[q.answer]}</span>
                    </>
                  )}
                </p>
                {q.explanation && <p className="mt-1 text-xs italic text-ink-soft">{q.explanation}</p>}
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex justify-center gap-2">
          <button
            className="btn-ghost"
            onClick={() => {
              setPos(0);
              setChosen(null);
              setAnswers([]);
              setDone(false);
            }}
          >
            <RotateCcw className="size-4" /> Retry same questions
          </button>
          <button className="btn-primary" onClick={() => void generate()} disabled={generating}>
            {generating ? "Writing questions…" : "New quiz"}
          </button>
        </div>
        {error && <p className="mt-3 text-center text-sm text-marker">{error}</p>}
      </div>
    );
  }

  /* ---------- active question ---------- */
  const q = questions[pos];
  const revealed = chosen !== null;
  const last = pos === questions.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      {/* progress */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((pos + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        <span className="font-mono text-xs text-ink-soft">
          {pos + 1} / {questions.length}
        </span>
      </div>

      <div className="card px-6 py-5">
        <p className="font-display text-xl leading-snug font-medium">{q.question}</p>
        <ul className="mt-4 space-y-2">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answer;
            const isChosen = i === chosen;
            return (
              <li key={i}>
                <button
                  disabled={revealed}
                  onClick={() => {
                    setChosen(i);
                    setAnswers((a) => [...a, { correct: i === q.answer, chosen: i }]);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                    !revealed && "cursor-pointer border-line bg-card hover:border-accent/60 hover:bg-accent-soft/40",
                    revealed && isAnswer && "border-accent/60 bg-accent-soft font-medium",
                    revealed && isChosen && !isAnswer && "border-marker/60 bg-marker/10",
                    revealed && !isChosen && !isAnswer && "border-line text-ink-soft",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]",
                      revealed && isAnswer
                        ? "border-accent bg-accent text-paper"
                        : revealed && isChosen
                          ? "border-marker bg-marker text-paper"
                          : "border-ink/30 text-ink-soft",
                    )}
                  >
                    {revealed && isAnswer ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : revealed && isChosen ? (
                      <X className="size-3" strokeWidth={3} />
                    ) : (
                      String.fromCharCode(65 + i)
                    )}
                  </span>
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
        {revealed && q.explanation && (
          <p className="mt-3 rounded-xl border border-line bg-paper-deep/50 px-4 py-2.5 text-xs italic text-ink-soft">
            {q.explanation}
          </p>
        )}
      </div>

      {revealed && (
        <div className="mt-4 flex justify-end">
          <button
            className="btn-primary"
            onClick={() => {
              if (last) {
                setDone(true);
              } else {
                setPos((p) => p + 1);
                setChosen(null);
              }
            }}
          >
            {last ? "See results" : "Next question"} <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 font-mono text-[10px] text-ink-soft">
        <CircleHelp className="size-3" /> generated from {selectedDocIds.length}{" "}
        {selectedDocIds.length === 1 ? "document" : "documents"} · sessions stay on this device
      </p>
    </div>
  );
}
