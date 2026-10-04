"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  Download,
  Layers,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import type { Deck, Flashcard } from "@/lib/types";
import { useStudyRoomStore } from "@/lib/store/studyroom";
import { cn, summarizeProviderError } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth/appwrite";
import { useAuthStore } from "@/lib/store/auth";
import { EmptyState } from "@/components/ui/bits";
import SetupNotice from "@/components/study-room/SetupNotice";
import AuthRequiredNotice from "@/components/study-room/AuthRequiredNotice";

function shuffled(n: number) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** CSV with a BOM so Excel opens the umlauts correctly */
function deckToCsv(title: string, cards: Flashcard[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = ["front,back", ...cards.map((c) => `${esc(c.front)},${esc(c.back)}`)].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "deck"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FlashcardsPanel({ configured }: { configured: boolean }) {
  const documents = useStudyRoomStore((s) => s.documents);
  const selectedDocIds = useStudyRoomStore((s) => s.selectedDocIds);
  const decks = useStudyRoomStore((s) => s.decks);
  const addDeck = useStudyRoomStore((s) => s.addDeck);
  const removeDeck = useStudyRoomStore((s) => s.removeDeck);

  const [activeDeckId, setActiveDeckId] = useState<string | null>(decks[0]?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const deck: Deck | null = useMemo(
    () => decks.find((d) => d.id === activeDeckId) ?? decks[0] ?? null,
    [decks, activeDeckId],
  );

  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [again, setAgain] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(1);

  // reset study state whenever the active deck changes
  const deckId = deck?.id ?? null;
  const [seenDeck, setSeenDeck] = useState<string | null>(deckId);
  if (deckId !== seenDeck) {
    setSeenDeck(deckId);
    setOrder(deck ? shuffled(deck.cards.length) : []);
    setPos(0);
    setFlipped(false);
    setKnown(new Set());
    setAgain(new Set());
    setRound(1);
  }

  // all hooks above this line — `configured` flips after the page's fetch
  const signedIn = useAuthStore((s) => s.status) === "signed-in";

  const card = deck && order.length > 0 && pos < order.length ? deck.cards[order[pos]] : null;
  const roundComplete = deck !== null && order.length > 0 && pos >= order.length;

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/study-room/flashcards", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ documentIds: selectedDocIds }),
      });
      const json = (await res.json().catch(() => null)) as
        | { title?: string; cards?: Flashcard[] }
        | { error?: string; detail?: string }
        | null;
      if (!res.ok || !json || !("cards" in json) || !json.cards?.length) {
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
                  : "The AI didn't return usable flashcards. Try again or pick different documents.",
        );
        return;
      }
      const created = addDeck({
        title: json.title ?? "Flashcards",
        documentIds: selectedDocIds,
        cards: json.cards,
      });
      setActiveDeckId(created.id);
    } catch {
      setError("Could not reach the AI provider.");
    } finally {
      setGenerating(false);
    }
  };

  const markKnown = () => {
    if (!card) return;
    setKnown((k) => new Set(k).add(card.id));
    setAgain((a) => {
      const n = new Set(a);
      n.delete(card.id);
      return n;
    });
    setFlipped(false);
    setPos((p) => p + 1);
  };

  const markAgain = () => {
    if (!card) return;
    setAgain((a) => new Set(a).add(card.id));
    setKnown((k) => {
      const n = new Set(k);
      n.delete(card.id);
      return n;
    });
    setOrder((o) => [...o, o[pos]]); // the card comes around once more
    setFlipped(false);
    setPos((p) => p + 1);
  };

  const practiceRepeats = () => {
    if (!deck) return;
    const idx = deck.cards
      .map((c, i) => (again.has(c.id) ? i : -1))
      .filter((i) => i >= 0);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    setOrder(idx);
    setKnown(new Set());
    setAgain(new Set());
    setPos(0);
    setFlipped(false);
    setRound((r) => r + 1);
  };

  const restartDeck = () => {
    if (!deck) return;
    setOrder(shuffled(deck.cards.length));
    setKnown(new Set());
    setAgain(new Set());
    setPos(0);
    setFlipped(false);
    setRound(1);
  };

  if (!configured) return <SetupNotice kind="flashcards" />;
  if (!signedIn) return <AuthRequiredNotice feature="generate flashcards" />;

  if (decks.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<Layers className="size-8" />}
          title="No decks yet"
          hint={
            selectedDocIds.length > 0
              ? "Turn your selected documents into a deck of flashcards."
              : "Upload material first and tick it as AI context, then generate your deck."
          }
          action={
            <button
              className="btn-primary"
              onClick={() => void generate()}
              disabled={generating || selectedDocIds.length === 0}
            >
              <Plus className="size-4" />
              {generating
                ? "Generating…"
                : `Generate from ${selectedDocIds.length} ${selectedDocIds.length === 1 ? "document" : "documents"}`}
            </button>
          }
        />
        {error && <p className="text-center text-sm text-marker">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* deck header */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          {decks.length > 1 ? (
            <select
              className="field w-auto max-w-full cursor-pointer py-1.5"
              value={deck!.id}
              onChange={(e) => setActiveDeckId(e.target.value)}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} · {d.cards.length} cards
                </option>
              ))}
            </select>
          ) : (
            <h2 className="font-display text-xl font-semibold tracking-tight">{deck!.title}</h2>
          )}
        </div>
        <button
          className="btn-icon size-9"
          aria-label="Export deck as CSV"
          title="Export as CSV"
          onClick={() => deckToCsv(deck!.title, deck!.cards)}
        >
          <Download className="size-4" />
        </button>
        <button className="btn-ghost" onClick={() => void generate()} disabled={generating}>
          <Plus className="size-4" /> {generating ? "Generating…" : "New deck"}
        </button>
        <button
          className="btn-icon hover:text-marker"
          aria-label="Delete deck"
          onClick={() => removeDeck(deck!.id)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* round summary — the practice loop's payoff */}
      {roundComplete ? (
        <div className="card flex flex-col items-center px-6 py-8 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-accent/50 bg-accent-soft text-accent">
            {again.size === 0 ? (
              <Check className="size-6" strokeWidth={2.5} />
            ) : (
              <RotateCcw className="size-5" />
            )}
          </span>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {again.size === 0 ? "Deck learned." : `Round ${round} done.`}
          </p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            {again.size === 0
              ? `${known.size} of ${deck!.cards.length} cards solid. Shuffle and run it again anytime.`
              : `${known.size} known, ${again.size} to repeat. Run the misses once more until they stick.`}
          </p>
          <div className="mt-5 flex gap-2">
            {again.size > 0 && (
              <button className="btn-primary" onClick={practiceRepeats}>
                Practice {again.size} {again.size === 1 ? "repeat" : "repeats"}
              </button>
            )}
            <button className="btn-ghost" onClick={restartDeck}>
              <RotateCcw className="size-4" /> Restart deck
            </button>
          </div>
        </div>
      ) : card ? (
        <>
          {/* flip card */}
          <div
            className="h-80 cursor-pointer [perspective:1200px]"
            onClick={() => setFlipped((f) => !f)}
          >
            <div
              className={cn(
                "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
                flipped && "[transform:rotateY(180deg)]",
              )}
            >
              <div className="absolute inset-0 flex flex-col rounded-2xl border border-line bg-card p-8 [backface-visibility:hidden]">
                <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                  question
                </span>
                <p className="flex flex-1 items-center justify-center text-center font-display text-2xl leading-snug font-medium">
                  {card.front}
                </p>
                <span className="text-center font-mono text-[10px] text-ink-soft">
                  click to flip
                </span>
              </div>
              <div className="absolute inset-0 flex flex-col rounded-2xl border border-accent/40 bg-accent-soft p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <span className="font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
                  answer
                </span>
                <p className="flex flex-1 items-center justify-center overflow-y-auto text-center text-base leading-relaxed">
                  {card.back}
                </p>
              </div>
            </div>
          </div>

          {/* progress */}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${((known.size / deck!.cards.length) * 100).toFixed(1)}%` }}
            />
          </div>

          {/* controls */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              className="btn-icon size-9"
              aria-label="Previous card"
              disabled={pos === 0}
              onClick={() => {
                setFlipped(false);
                setPos((p) => Math.max(0, p - 1));
              }}
            >
              <ChevronLeft className="size-4" />
            </button>

            <span className="font-mono text-xs text-ink-soft">
              {Math.min(pos + 1, deck!.cards.length)} / {deck!.cards.length}
              {known.size > 0 && ` · ${known.size} known`}
              {again.size > 0 && ` · ${again.size} again`}
            </span>

            <div className="flex gap-1">
              <button
                className="btn-icon size-9"
                aria-label="Shuffle"
                onClick={() => {
                  setOrder(shuffled(deck!.cards.length));
                  setPos(0);
                  setFlipped(false);
                }}
              >
                <Shuffle className="size-4" />
              </button>
              <button
                className="btn-icon size-9"
                aria-label="Reset progress"
                onClick={restartDeck}
              >
                <RotateCcw className="size-4" />
              </button>
            </div>

            {flipped ? (
              <div className="flex gap-2">
                <button className="btn-ghost hover:border-marker/60 hover:text-marker" onClick={markAgain}>
                  <X className="size-4" /> Again
                </button>
                <button className="btn-primary" onClick={markKnown}>
                  <Check className="size-4" /> Got it
                </button>
              </div>
            ) : (
              <button className="btn-ghost" onClick={() => setFlipped(true)}>
                Flip
              </button>
            )}
          </div>
        </>
      ) : (
        <EmptyState title="Empty deck" hint="This deck has no cards." />
      )}

      {error && <p className="mt-4 text-center text-sm text-marker">{error}</p>}
    </div>
  );
}
