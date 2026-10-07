"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookMarked,
  List,
  Loader2,
  MessageSquarePlus,
  Minus,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import type { Book, Rendition, Contents, NavItem } from "epubjs";
import { getBookFile } from "@/lib/books-db";
import {
  HIGHLIGHT_COLORS,
  useBooksStore,
  type BookHighlight,
  type HighlightColor,
} from "@/lib/store/books";
import { DEFAULT_READING, useSettingsStore } from "@/lib/store/settings";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The EPUB reader: epub.js renders paginated chapters inside an iframe, the
 * reading position is saved automatically on every turn (exact CFI + rough
 * percentage), and text selections become highlights in four colors with an
 * optional comment. Highlights render as annotations and survive font and
 * layout changes because they address the text itself, not pixels.
 */

const READER_THEMES = {
  light: { bg: "#f5f2ea", fg: "#26221b" },
  sepia: { bg: "#efe6d4", fg: "#3a332a" },
  dark: { bg: "#1a1812", fg: "#d8d2c2" },
};

interface SelectionPopup {
  /** existing highlight id when editing, undefined for a fresh selection */
  highlightId?: string;
  cfiRange: string;
  text: string;
  color?: HighlightColor;
  comment?: string;
  x: number;
  y: number;
}

export default function BookReader({ bookId }: { bookId: string }) {
  const t = useT();
  const meta = useBooksStore((s) => s.books.find((b) => b.id === bookId));
  const allHighlights = useBooksStore((s) => s.highlights);
  const highlights = useMemo(
    () => allHighlights.filter((h) => h.bookId === bookId),
    [allHighlights, bookId],
  );
  const setProgress = useBooksStore((s) => s.setProgress);
  const addHighlight = useBooksStore((s) => s.addHighlight);
  const updateHighlight = useBooksStore((s) => s.updateHighlight);
  const removeHighlight = useBooksStore((s) => s.removeHighlight);
  const reading = useSettingsStore((s) => s.reading);
  const setReading = useSettingsStore((s) => s.setReading);

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** last pointer position inside the iframe, for annotation-click popups */
  const lastClick = useRef<{ x: number; y: number } | null>(null);
  /** last known position — lets teardown flush without touching epub.js */
  const lastLocation = useRef<{ cfi: string; index: number; percentage?: number } | null>(null);

  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [percent, setPercent] = useState(meta?.percentage ?? 0);
  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drawer, setDrawer] = useState<"none" | "toc" | "notes">("none");
  const [toc, setToc] = useState<Array<{ label: string; href: string; depth: number }>>([]);

  /** apply the current reading prefs to the rendition */
  const applyPrefs = useCallback(
    (rendition: Rendition, prefs: typeof DEFAULT_READING) => {
      rendition.themes.select(prefs.theme);
      rendition.themes.fontSize(`${prefs.fontSize}%`);
      rendition.themes.font(prefs.serif ? "Georgia, 'Times New Roman', serif" : "'Instrument Sans', sans-serif");
      rendition.themes.override("line-height", String(prefs.spacing), true);
    },
    [],
  );

  /**
   * inject one highlight into the rendered section: resolve its CFI to a
   * DOM range and wrap the covered text nodes in a styled span. epub.js's
   * own annotations module silently fails to inject in this build, so this
   * is done by hand — deterministic and rebuildable at any time.
   */
  const injectHighlight = useCallback(
    async (
      rendition: Rendition,
      h: Pick<BookHighlight, "id" | "cfiRange" | "color">,
    ): Promise<boolean> => {
      let range: Range;
      try {
        range = await rendition.getRange(h.cfiRange);
      } catch {
        return false; // not in a currently rendered section
      }
      const doc = range.startContainer.ownerDocument;
      if (!doc) return false;

      // when the range lives inside one text node, the common ancestor IS
      // that text node — walk its parent instead (a walker skips its root)
      const ancestor =
        range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentNode
          : range.commonAncestorContainer;
      if (!ancestor) return false;

      const nodes: Text[] = [];
      const walker = doc.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        if (range.intersectsNode(node) && node.nodeValue && node.nodeValue.length > 0)
          nodes.push(node);
        node = walker.nextNode() as Text | null;
      }

      let wrapped = false;
      for (const textNode of nodes) {
        const text = textNode.nodeValue ?? "";
        const start = textNode === range.startContainer ? range.startOffset : 0;
        const end = textNode === range.endContainer ? range.endOffset : text.length;
        if (start >= end) continue;
        const span = doc.createElement("span");
        span.className = `hl-${h.color}`;
        span.dataset.hlId = h.id;
        const part = doc.createRange();
        part.setStart(textNode, start);
        part.setEnd(textNode, end);
        try {
          part.surroundContents(span);
          wrapped = true;
        } catch {
          /* partially wrapped node from a neighboring highlight — skip */
        }
      }
      return wrapped;
    },
    [],
  );

  /** unwrap every span of a deleted highlight */
  const removeHighlightSpans = useCallback((id: string) => {
    for (const frame of Array.from(document.querySelectorAll("iframe"))) {
      const doc = frame.contentDocument;
      if (!doc) continue;
      for (const span of Array.from(doc.querySelectorAll(`[data-hl-id="${id}"]`))) {
        const parent = span.parentNode;
        if (!parent) continue;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
        parent.normalize();
      }
    }
  }, []);

  /* ---------- paging: arrows, wheel ---------- */
  const turn = useCallback((dir: "next" | "prev") => {
    setPopup(null);
    setCommenting(false);
    if (dir === "next") renditionRef.current?.next();
    else renditionRef.current?.prev();
  }, []);

  // mouse wheel turns the pages — accumulated deltas with a short cooldown,
  // so trackpads glide instead of racing through the book. Attached inside
  // the iframe (where the wheel events actually land) and on the container
  // for the gaps around it.
  const makeWheelHandler = useCallback(() => {
    let acc = 0;
    let cooldownUntil = 0;
    return (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now < cooldownUntil) return;
      acc += e.deltaY;
      if (Math.abs(acc) >= 60) {
        const forward = acc > 0;
        acc = 0;
        cooldownUntil = now + 450;
        turn(forward ? "next" : "prev");
      }
    };
  }, [turn]);

  /* ---------- load the book and mount the rendition ---------- */
  useEffect(() => {
    let cancelled = false;
    let localBook: Book | null = null;

    (async () => {
      try {
        const [{ default: ePub }, blob] = await Promise.all([
          import("epubjs"),
          getBookFile(bookId),
        ]);
        if (!blob || cancelled) throw new Error("missing");

        const buffer = await blob.arrayBuffer();
        const book = ePub(buffer);
        localBook = book;
        bookRef.current = book;
        if (cancelled || !viewerRef.current) return;

        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          spread: "none",
        });
        renditionRef.current = rendition;

        const prefs = useSettingsStore.getState().reading;
        rendition.themes.register("light", {
          body: { background: READER_THEMES.light.bg, color: READER_THEMES.light.fg },
          ".hl-yellow": { "background-color": "rgba(232, 197, 89, .4)" },
          ".hl-green": { "background-color": "rgba(157, 192, 139, .45)" },
          ".hl-blue": { "background-color": "rgba(146, 180, 213, .45)" },
          ".hl-rose": { "background-color": "rgba(219, 154, 171, .45)" },
        });
        rendition.themes.register("sepia", {
          body: { background: READER_THEMES.sepia.bg, color: READER_THEMES.sepia.fg },
          ".hl-yellow": { "background-color": "rgba(232, 197, 89, .45)" },
          ".hl-green": { "background-color": "rgba(157, 192, 139, .5)" },
          ".hl-blue": { "background-color": "rgba(146, 180, 213, .5)" },
          ".hl-rose": { "background-color": "rgba(219, 154, 171, .5)" },
        });
        rendition.themes.register("dark", {
          body: { background: READER_THEMES.dark.bg, color: READER_THEMES.dark.fg },
          ".hl-yellow": { "background-color": "rgba(232, 197, 89, .3)" },
          ".hl-green": { "background-color": "rgba(157, 192, 139, .3)" },
          ".hl-blue": { "background-color": "rgba(146, 180, 213, .3)" },
          ".hl-rose": { "background-color": "rgba(219, 154, 171, .3)" },
        });
        applyPrefs(rendition, prefs);

        // clicks + wheel inside the iframe: anchor popups, page through
        rendition.on("rendered", (_section: unknown, contents: Contents) => {
          contents.document.addEventListener(
            "wheel",
            makeWheelHandler(),
            { passive: false },
          );
          contents.document.addEventListener(
            "click",
            (e: MouseEvent) => {
              const frame = contents.document.defaultView?.frameElement as HTMLElement | null;
              const off = frame?.getBoundingClientRect();
              const x = (off?.left ?? 0) + e.clientX;
              const y = (off?.top ?? 0) + e.clientY;
              lastClick.current = { x, y };
              const hlSpan = (e.target as HTMLElement).closest?.("[data-hl-id]");
              if (hlSpan) {
                const id = hlSpan.getAttribute("data-hl-id");
                const h = useBooksStore.getState().highlights.find((x2) => x2.id === id);
                if (h) {
                  setPopup({
                    highlightId: h.id,
                    cfiRange: h.cfiRange,
                    text: h.text,
                    color: h.color,
                    comment: h.comment,
                    x,
                    y,
                  });
                  setCommenting(false);
                }
              }
            },
            true,
          );
          // a freshly rendered section lost its highlight spans — re-inject
          for (const h of useBooksStore.getState().highlights) {
            if (h.bookId !== bookId) continue;
            void injectHighlight(rendition, h);
          }
        });

        // text selection → highlight popup
        rendition.on("selected", (cfiRange: string, contents: Contents) => {
          const sel = contents.window.getSelection();
          if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
          const text = sel.toString();
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          const frame = contents.document.defaultView?.frameElement as HTMLElement | null;
          const off = frame?.getBoundingClientRect();
          setPopup({
            cfiRange,
            text,
            x: (off?.left ?? 0) + rect.left + rect.width / 2,
            y: (off?.top ?? 0) + rect.top,
          });
          setCommenting(false);
        });

        // auto-save the reading position (debounced); keep the freshest
        // position in a ref so teardown never has to call back into epub.js
        rendition.on("relocated", (location: { start: { cfi: string; index: number; percentage?: number } }) => {
          lastLocation.current = location.start;
          const pct =
            location.start.percentage && location.start.percentage > 0
              ? location.start.percentage
              : Math.min(
                  1,
                  (location.start.index + 1) /
                    Math.max(
                      1,
                      (book.spine as unknown as { items?: unknown[] }).items?.length ?? 1,
                    ),
                );
          setPercent(pct);
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            setProgress(bookId, location.start.cfi, pct);
          }, 700);
        });

        // resume where we stopped, otherwise the start
        const saved = useBooksStore.getState().books.find((b) => b.id === bookId);
        await rendition.display(saved?.cfi || undefined);
        if (!cancelled) setStatus("ready");

        // inject the saved highlights into the sections on screen now
        for (const h of useBooksStore.getState().highlights) {
          if (h.bookId !== bookId) continue;
          void injectHighlight(rendition, h);
        }

        // chapter list
        const nav = (await book.loaded.navigation) as { toc: NavItem[] };
        if (cancelled) return;
        const flat: Array<{ label: string; href: string; depth: number }> = [];
        const walk = (items: NavItem[], depth: number) => {
          for (const item of items) {
            flat.push({ label: item.label.trim(), href: item.href, depth });
            if (item.subitems?.length) walk(item.subitems as NavItem[], depth + 1);
          }
        };
        walk(nav.toc ?? [], 0);
        setToc(flat);

        // accurate percentages need generated locations — chunked, background
        void book.locations
          .generate(1024)
          .then(() => {
            if (cancelled || !renditionRef.current) return;
            const loc = renditionRef.current.currentLocation() as unknown as {
              start: { cfi: string; index: number; percentage?: number };
            };
            if (loc?.start) {
              const pct = loc.start.percentage ?? 0;
              setPercent(pct);
              setProgress(bookId, loc.start.cfi, pct);
            }
          })
          .catch(() => undefined);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // flush the last position before tearing down — use the ref from the
      // relocated events; calling back into epub.js here can hit an already
      // destroyed iframe
      const loc = lastLocation.current;
      if (loc?.cfi) {
        const pct =
          loc.percentage && loc.percentage > 0
            ? loc.percentage
            : Math.min(
                1,
                (loc.index + 1) /
                  Math.max(
                    1,
                    (localBook?.spine as unknown as { items?: unknown[] })?.items?.length ?? 1,
                  ),
              );
        setProgress(bookId, loc.cfi, pct);
      }
      try {
        renditionRef.current?.destroy();
      } catch {
        /* epub.js can throw while tearing down a half-built view */
      }
      try {
        localBook?.destroy();
      } catch {
        /* ditto */
      }
      bookRef.current = null;
      renditionRef.current = null;
      lastLocation.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once per book
  }, [bookId]);

  /* ---------- live-apply reading preferences ---------- */
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || status !== "ready") return;
    applyPrefs(rendition, reading);
  }, [reading, status, applyPrefs]);

  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") turn("next");
      if (e.key === "ArrowLeft") turn("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, turn]);

  useEffect(() => {
    if (status !== "ready") return;
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = makeWheelHandler();
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [status, makeWheelHandler]);

  const closePopup = () => {
    setPopup(null);
    setCommenting(false);
    // drop the text selection the popup was made from
    for (const frame of Array.from(document.querySelectorAll("iframe"))) {
      try {
        frame.contentDocument?.defaultView?.getSelection()?.removeAllRanges();
      } catch {
        /* cross-origin frame — not ours */
      }
    }
  };

  const pickColor = (color: HighlightColor) => {
    if (!popup) return;
    if (popup.highlightId) {
      const existing = highlights.find((h) => h.id === popup.highlightId);
      updateHighlight(popup.highlightId, { color });
      if (existing && renditionRef.current) {
        removeHighlightSpans(existing.id);
        void injectHighlight(renditionRef.current, { id: existing.id, cfiRange: existing.cfiRange, color });
      }
      setPopup({ ...popup, color });
    } else {
      const id = addHighlight({
        bookId,
        cfiRange: popup.cfiRange,
        color,
        text: popup.text,
      });
      if (renditionRef.current) {
        void injectHighlight(renditionRef.current, { id, cfiRange: popup.cfiRange, color });
      }
      setPopup({ ...popup, highlightId: id, color });
      setCommenting(true);
    }
  };

  const deleteCurrentHighlight = () => {
    if (!popup?.highlightId) return closePopup();
    removeHighlight(popup.highlightId);
    removeHighlightSpans(popup.highlightId);
    closePopup();
  };

  const theme = READER_THEMES[reading.theme];
  const bookHighlights = useMemo(
    () => [...highlights].sort((a, b) => a.createdAt - b.createdAt),
    [highlights],
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: theme.bg }}>
      {/* top bar */}
      <div
        className="flex h-12 shrink-0 items-center gap-2 px-3"
        style={{ background: theme.bg, color: theme.fg, borderBottom: "1px solid rgba(128,120,100,.25)" }}
      >
        <Link
          href="/read"
          className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-ink/10"
          aria-label={t("Library")}
          style={{ color: theme.fg }}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
          {meta?.title ?? t("Book")}
        </p>
        <button
          onClick={() => setDrawer(drawer === "toc" ? "none" : "toc")}
          className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-ink/10"
          aria-label={t("Table of contents")}
          style={{ color: drawer === "toc" ? "var(--color-accent)" : theme.fg }}
        >
          <List className="size-4" />
        </button>
        <button
          onClick={() => setDrawer(drawer === "notes" ? "none" : "notes")}
          className="relative grid size-8 place-items-center rounded-lg transition-colors hover:bg-ink/10"
          aria-label={t("Highlights & comments")}
          style={{ color: drawer === "notes" ? "var(--color-accent)" : theme.fg }}
        >
          <BookMarked className="size-4" />
          {bookHighlights.length > 0 && (
            <span
              className="absolute right-0.5 top-0.5 grid size-3.5 place-items-center rounded-full font-mono text-[8px]"
              style={{ background: "var(--color-accent)", color: "#f5f2ea" }}
            >
              {bookHighlights.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-ink/10"
          aria-label={t("Reading settings")}
          style={{ color: showSettings ? "var(--color-accent)" : theme.fg }}
        >
          <Settings2 className="size-4" />
        </button>
      </div>

      {/* reading settings bar */}
      {showSettings && (
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-xs"
          style={{ background: theme.bg, color: theme.fg, borderBottom: "1px solid rgba(128,120,100,.25)" }}
        >
          <div className="flex items-center gap-1.5">
            <button
              className="grid size-6 place-items-center rounded-md hover:bg-ink/10"
              onClick={() => setReading({ fontSize: Math.max(80, reading.fontSize - 10) })}
              aria-label={t("Smaller text")}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-10 text-center font-mono">{reading.fontSize}%</span>
            <button
              className="grid size-6 place-items-center rounded-md hover:bg-ink/10"
              onClick={() => setReading({ fontSize: Math.min(220, reading.fontSize + 10) })}
              aria-label={t("Larger text")}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              className={cn("rounded-md px-2 py-1 transition-colors hover:bg-ink/10", reading.serif && "font-semibold")}
              style={{ fontFamily: "Georgia, serif" }}
              onClick={() => setReading({ serif: true })}
            >
              {t("Serif")}
            </button>
            <button
              className={cn("rounded-md px-2 py-1 transition-colors hover:bg-ink/10", !reading.serif && "font-semibold")}
              onClick={() => setReading({ serif: false })}
            >
              {t("Sans")}
            </button>
          </div>
          <div className="flex items-center gap-1">
            {(["light", "sepia", "dark"] as const).map((th) => (
              <button
                key={th}
                onClick={() => setReading({ theme: th })}
                aria-label={t(th)}
                className={cn(
                  "size-5 rounded-full border-2",
                  reading.theme === th ? "scale-110" : "border-transparent",
                )}
                style={{
                  background: READER_THEMES[th].bg,
                  borderColor: reading.theme === th ? "var(--color-accent)" : "transparent",
                  boxShadow: "inset 0 0 0 1px rgba(128,120,100,.4)",
                }}
              />
            ))}
          </div>
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] opacity-70">{t("Line spacing")}</span>
            <select
              value={reading.spacing}
              onChange={(e) => setReading({ spacing: Number(e.target.value) })}
              className="cursor-pointer rounded-md border-0 bg-transparent font-mono text-xs outline-none hover:bg-ink/10"
              style={{ color: theme.fg }}
            >
              <option value={1.4}>1,4</option>
              <option value={1.6}>1,6</option>
              <option value={1.8}>1,8</option>
              <option value={2}>2,0</option>
            </select>
          </label>
        </div>
      )}

      {/* drawers */}
      {drawer !== "none" && (
        <div
          className="max-h-56 shrink-0 overflow-y-auto px-4 py-3 text-sm"
          style={{ background: theme.bg, color: theme.fg, borderBottom: "1px solid rgba(128,120,100,.25)" }}
        >
          {drawer === "toc" ? (
            toc.length === 0 ? (
              <p className="py-2 italic opacity-60">{t("This book has no chapter list.")}</p>
            ) : (
              <ul>
                {toc.map((item, i) => (
                  <li key={`${item.href}-${i}`}>
                    <button
                      className="block w-full cursor-pointer truncate rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink/10"
                      style={{ paddingLeft: `${8 + item.depth * 16}px` }}
                      onClick={() => {
                        renditionRef.current?.display(item.href);
                        setDrawer("none");
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : bookHighlights.length === 0 ? (
            <p className="py-2 italic opacity-60">
              {t("Select text while reading to highlight it in a color and add a comment.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {bookHighlights.map((h) => {
                const c = HIGHLIGHT_COLORS.find((x) => x.id === h.color) ?? HIGHLIGHT_COLORS[0];
                return (
                  <li key={h.id}>
                    <button
                      className="block w-full cursor-pointer rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink/10"
                      onClick={() => {
                        renditionRef.current?.display(h.cfiRange);
                        setDrawer("none");
                      }}
                    >
                      <span className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block size-2.5 shrink-0 rounded-full"
                          style={{ background: c.hex }}
                        />
                        <span className="min-w-0">
                          <span className="line-clamp-2 block text-xs leading-snug opacity-90">
                            „{h.text.slice(0, 180)}{h.text.length > 180 ? "…" : ""}“
                          </span>
                          {h.comment && (
                            <span className="mt-0.5 block text-xs italic opacity-70">{h.comment}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* the book itself */}
      <div className="relative min-h-0 flex-1">
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center" style={{ color: theme.fg }}>
            <span className="flex items-center gap-2 text-sm opacity-70">
              <Loader2 className="size-4 animate-spin" /> {t("Opening the book…")}
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center" style={{ color: theme.fg }}>
            <div>
              <p className="font-display text-lg font-semibold">{t("The book could not be opened.")}</p>
              <p className="mt-1 text-sm opacity-70">
                {t("Is the file still on this device? Re-import it from the library if in doubt.")}
              </p>
              <Link href="/read" className="btn-ghost mt-4 inline-flex">
                <ArrowLeft className="size-4" /> {t("Back to the library")}
              </Link>
            </div>
          </div>
        )}
        <div
          ref={viewerRef}
          className="h-full w-full"
          style={{ visibility: status === "ready" ? "visible" : "hidden" }}
        />
      </div>

      {/* progress */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ background: theme.bg, color: theme.fg, borderTop: "1px solid rgba(128,120,100,.25)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(128,120,100,.3)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${Math.round(percent * 100)}%`, background: "var(--color-accent)" }}
            />
          </div>
          <span className="w-12 text-right font-mono text-[10px] opacity-70">
            {Math.round(percent * 100)}%
          </span>
          <button
            onClick={() => turn("prev")}
            className="grid size-7 place-items-center rounded-md hover:bg-ink/10"
            aria-label={t("Previous page")}
          >
            ←
          </button>
          <button
            onClick={() => turn("next")}
            className="grid size-7 place-items-center rounded-md hover:bg-ink/10"
            aria-label={t("Next page")}
          >
            →
          </button>
        </div>
      </div>

      {/* selection / highlight popup */}
      {popup && (
        <>
          <div className="fixed inset-0 z-10 cursor-default" onClick={closePopup} aria-hidden />
          <div
            className="fixed z-20 w-64 rounded-xl border p-2.5 shadow-2xl"
            role="dialog"
            aria-label={popup.highlightId ? t("Edit highlight") : t("Highlight")}
            style={{
              left: Math.min(Math.max(popup.x, 140), window.innerWidth - 140),
              top: Math.max(popup.y - 16, 60),
              transform: "translate(-50%, -100%)",
              background: "var(--color-card)",
              borderColor: "var(--color-line)",
              color: "var(--color-ink)",
            }}
          >
            <div className="flex items-center gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickColor(c.id)}
                  aria-label={c.label}
                  className={cn(
                    "size-6 cursor-pointer rounded-full border-2 transition-transform hover:scale-110",
                    popup.color === c.id ? "scale-110" : "border-transparent",
                  )}
                  style={{
                    background: c.hex,
                    borderColor: popup.color === c.id ? "var(--color-ink)" : "transparent",
                  }}
                />
              ))}
              {popup.highlightId && (
                <>
                  <button
                    onClick={() => setCommenting((v) => !v)}
                    className="cursor-pointer rounded-md p-1.5 transition-colors hover:bg-ink/10"
                    aria-label={t("Comment")}
                    title={t("Comment")}
                  >
                    <MessageSquarePlus className="size-4" />
                  </button>
                  <button
                    onClick={deleteCurrentHighlight}
                    className="cursor-pointer rounded-md p-1.5 transition-colors hover:bg-ink/10 hover:text-marker"
                    aria-label={t("Delete")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
              <button
                onClick={closePopup}
                className="ml-auto cursor-pointer rounded-md p-1.5 transition-colors hover:bg-ink/10"
                aria-label={t("Close")}
              >
                <X className="size-4" />
              </button>
            </div>
            {commenting && popup.highlightId && (
              <textarea
                autoFocus
                defaultValue={popup.comment ?? ""}
                placeholder={t("Your comment…")}
                onChange={(e) => {
                  updateHighlight(popup.highlightId!, { comment: e.target.value.trim() || undefined });
                }}
                className="field mt-2 min-h-16 resize-none text-xs"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
