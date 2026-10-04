"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, MessageCircle, RotateCcw, SendHorizontal, Square, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { useStudyRoomStore } from "@/lib/store/studyroom";
import { cn, summarizeProviderError } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth/appwrite";
import { useAuthStore } from "@/lib/store/auth";
import Markdown from "@/components/study-room/Markdown";
import SetupNotice from "@/components/study-room/SetupNotice";
import AuthRequiredNotice from "@/components/study-room/AuthRequiredNotice";

export default function ChatPanel({ configured }: { configured: boolean }) {
  const chat = useStudyRoomStore((s) => s.chat);
  const appendMessage = useStudyRoomStore((s) => s.appendMessage);
  const updateLastAssistant = useStudyRoomStore((s) => s.updateLastAssistant);
  const clearChat = useStudyRoomStore((s) => s.clearChat);
  const documents = useStudyRoomStore((s) => s.documents);
  const selectedDocIds = useStudyRoomStore((s) => s.selectedDocIds);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // keep the latest message in view while tokens stream in
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  /** streams one assistant answer into the trailing (empty) message */
  const runStream = async (history: ChatMessage[]) => {
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/study-room/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          documentIds: selectedDocIds,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;
        const detail = summarizeProviderError(json?.detail);
        updateLastAssistant(
          json?.error === "not_configured"
            ? "AI is not configured: add an API key to `.env.local` and restart the server."
            : json?.error === "auth_required"
              ? "Sign in first: use “Sign in to sync” in the sidebar."
              : json?.error === "ai_locked"
                ? "AI access is member-only right now. Ask the admin to add you to the AI team."
                : detail
                  ? `The AI provider rejected the request: ${detail}`
                  : "Sorry, the AI provider returned an error. Please try again.",
        );
        setProviderError(detail);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let sources: string[] | undefined;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        // the first line is a JSON frame with the source document names
        const nl = raw.indexOf("\n");
        if (sources === undefined && nl >= 0) {
          try {
            sources = (JSON.parse(raw.slice(0, nl)) as { sources?: string[] }).sources ?? [];
          } catch {
            sources = [];
          }
          raw = raw.slice(nl + 1);
        }
        if (sources !== undefined) updateLastAssistant(raw, sources);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setProviderError("Connection to the AI provider failed.");
        updateLastAssistant("Connection to the AI provider failed.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    setProviderError("");
    setInput("");
    appendMessage({ role: "user", content: text });
    appendMessage({ role: "assistant", content: "" });
    void runStream([...chat, { role: "user", content: text }]);
  };

  /** streams a fresh answer for the last question, replacing the stale one */
  const regenerate = async () => {
    if (streaming || chat.length === 0) return;
    const lastUserIdx = chat.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;
    setProviderError("");
    appendMessage({ role: "assistant", content: "" });
    void runStream(chat.slice(0, lastUserIdx + 1));
  };

  // all hooks before any early return — `configured` flips after the page's
  // documents fetch, and a hook after a conditional return would crash React
  const signedIn = useAuthStore((s) => s.status) === "signed-in";
  if (!configured) return <SetupNotice kind="chat" />;
  if (!signedIn) return <AuthRequiredNotice feature="chat about your documents" />;

  const contextDocs = documents.filter((d) => selectedDocIds.includes(d.id));
  const contextChars = contextDocs.reduce((sum, d) => sum + d.chars, 0);

  return (
    <div className="mx-auto flex h-[calc(100dvh-16rem)] max-w-3xl flex-col md:h-[calc(100dvh-14rem)]">
      {/* context bar */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-soft">
        <span>
          context · {contextDocs.length} {contextDocs.length === 1 ? "document" : "documents"}
          {contextChars > 0 && ` · ${(contextChars / 1000).toFixed(0)}k chars`}
        </span>
        {contextDocs.length > 0 && (
          <span className="truncate text-ink-soft/70">({contextDocs.map((d) => d.name).join(", ")})</span>
        )}
        {chat.length > 0 && (
          <button
            className="ml-auto inline-flex cursor-pointer items-center gap-1 uppercase hover:text-marker"
            onClick={clearChat}
          >
            <Trash2 className="size-3" /> clear
          </button>
        )}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-line bg-card/60 p-4">
        {chat.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="mb-3 size-8 text-ink-soft" />
            <p className="font-display text-lg font-medium">Ask your documents</p>
            <p className="mt-1 max-w-sm text-sm text-ink-soft">
              {contextDocs.length > 0
                ? `Questions about ${contextDocs[0].name} and ${contextDocs.length - 1 > 0 ? `${contextDocs.length - 1} more selected document${contextDocs.length - 1 === 1 ? "" : "s"}` : "anything else"}. Answers cite their sources.`
                : "No documents selected, so the assistant will answer from general knowledge. Tick some documents under Material to ground it."}
            </p>
            <div className="mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
              {(contextDocs.length > 0
                ? [
                    "Summarize the key ideas",
                    "Quiz me on this material",
                    "Explain the hardest concept step by step",
                    "Make a study plan for the exam",
                  ]
                : ["What can the study room do?", "How do flashcard decks work?"]
              ).map((p) => (
                <button
                  key={p}
                  disabled={streaming}
                  onClick={() => void send(p)}
                  className="chip cursor-pointer transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.map((m: ChatMessage, i: number) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-ink whitespace-pre-wrap text-paper"
                    : "border border-line bg-card",
                )}
              >
                {m.role === "assistant" ? (
                  <>
                    {m.content ? (
                      <Markdown content={m.content} />
                    ) : (
                      <span className="inline-flex gap-1 py-1.5">
                        <span className="size-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:0ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:120ms]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-ink-soft [animation-delay:240ms]" />
                      </span>
                    )}
                    {streaming && i === chat.length - 1 && m.content && (
                      <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded-full bg-ink-soft align-middle" />
                    )}
                  </>
                ) : (
                  m.content
                )}
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <p className="mt-2 border-t border-line pt-2 font-mono text-[10px] text-ink-soft">
                    sources · {m.sources.join(", ")}
                  </p>
                )}
                {m.role === "assistant" && m.content && !(streaming && i === chat.length - 1) && (
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(m.content);
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 1500);
                    }}
                    className="mt-2 inline-flex cursor-pointer items-center gap-1 font-mono text-[10px] text-ink-soft transition-colors hover:text-ink"
                  >
                    <Copy className="size-3" /> {copiedIdx === i ? "copied" : "copy"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {providerError && (
        <p className="mt-2 font-mono text-xs text-marker">
          provider error · {providerError}
        </p>
      )}

      {/* regenerate — a fresh answer for the last question */}
      {!streaming && chat.length > 0 && chat[chat.length - 1].role === "assistant" && (
        <button
          onClick={() => void regenerate()}
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 self-start font-mono text-[11px] text-ink-soft transition-colors hover:text-ink"
        >
          <RotateCcw className="size-3" /> regenerate answer
        </button>
      )}

      {/* composer */}
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="field max-h-40 min-h-11 flex-1 resize-none py-3"
          placeholder="Ask something about your material…"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {streaming ? (
          <button
            type="button"
            className="btn-ghost h-11 shrink-0"
            onClick={() => abortRef.current?.abort()}
          >
            <Square className="size-4" /> Stop
          </button>
        ) : (
          <button type="submit" className="btn-primary h-11 shrink-0" disabled={!input.trim()}>
            <SendHorizontal className="size-4" /> Send
          </button>
        )}
      </form>
    </div>
  );
}
