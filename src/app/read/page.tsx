"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpenText, Loader2, Plus, Trash2 } from "lucide-react";
import { deleteBookFile, putBookFile } from "@/lib/books-db";
import { useBooksStore } from "@/lib/store/books";
import { useHydrated } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { EmptyState } from "@/components/ui/bits";
import BookReader from "@/components/read/BookReader";

/**
 * Lesen — the EPUB library and reader. /read shows the shelf, /read?b=<id>
 * opens the full-screen reader. Files stay in IndexedDB on this device;
 * metadata, position and highlights are small enough for the normal store.
 */

/** pull the data URL cover out of an epub, capped so localStorage stays small */
async function extractMeta(file: File) {
  const { default: ePub } = await import("epubjs");
  const book = ePub(await file.arrayBuffer());
  try {
    await book.ready;
    const meta = (book.packaging?.metadata ?? {}) as {
      title?: string;
      creator?: string;
    };
    let cover: string | undefined;
    try {
      const url = await book.coverUrl();
      if (url) {
        const blob = await (await fetch(url)).blob();
        if (blob.size <= 200_000) {
          cover = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
          }) || undefined;
        }
      }
    } catch {
      /* covers are optional */
    }
    return {
      title: meta.title?.trim() || file.name.replace(/\.epub$/i, ""),
      author: meta.creator?.trim() || "",
      cover,
    };
  } finally {
    book.destroy();
  }
}

/** Suspense wrapper — useSearchParams() needs one for static prerendering */
export default function ReadPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReadContent />
    </Suspense>
  );
}

function ReadContent() {
  const hydrated = useHydrated();
  const t = useT();
  const searchParams = useSearchParams();
  const bookId = searchParams.get("b");
  const books = useBooksStore((s) => s.books);
  const highlights = useBooksStore((s) => s.highlights);
  const addBook = useBooksStore((s) => s.addBook);
  const removeBookFromStore = useBooksStore((s) => s.removeBook);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const importFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".epub")) {
      setError(t("That is not an EPUB file."));
      return;
    }
    setImporting(true);
    setError("");
    try {
      const meta = await extractMeta(file);
      const id = addBook({ ...meta });
      await putBookFile(id, file);
    } catch {
      setError(t("The EPUB could not be read. Is the file intact?"));
    } finally {
      setImporting(false);
    }
  };

  const removeBook = async (id: string) => {
    if (!window.confirm(t("Remove this book? Its highlights and comments go with it."))) return;
    removeBookFromStore(id);
    await deleteBookFile(id);
  };

  if (!hydrated) return <PageSkeleton />;

  // full-screen reader mode
  if (bookId) {
    const exists = books.some((b) => b.id === bookId);
    if (exists) return <BookReader bookId={bookId} />;
  }

  const sorted = [...books].sort(
    (a, b) => (b.lastReadAt ?? b.addedAt) - (a.lastReadAt ?? a.addedAt),
  );

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
            {t("Reading")}
            <BookOpenText className="size-5 text-accent" />
          </h1>
          <p className="mt-1 font-mono text-xs tracking-wide text-ink-soft">
            {t("your EPUB library - reading position, highlights and comments stay")}
          </p>
        </div>
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {importing ? t("Importing…") : t("Import EPUB")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,application/epub+zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
      </header>

      {error && <p className="mb-4 text-sm text-marker">{error}</p>}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<BookOpenText className="size-8" />}
          title={t("No books yet")}
          hint={t("Import an EPUB and read it right here: adjustable text, automatic reading position, highlights in four colors and comments.")}
          action={
            <button className="btn-primary" onClick={() => fileRef.current?.click()}>
              <Plus className="size-4" /> {t("Import EPUB")}
            </button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((book) => {
            const count = highlights.filter((h) => h.bookId === book.id).length;
            const pct = Math.round((book.percentage ?? 0) * 100);
            return (
              <li key={book.id} className="card group overflow-hidden">
                <Link href={`/read?b=${book.id}`} className="block">
                  <div className="flex gap-4 p-4">
                    <div className="h-36 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-paper-deep">
                      {book.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element -- data URL cover
                        <img src={book.cover} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center text-ink-soft">
                          <BookOpenText className="size-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 font-display text-base leading-snug font-semibold tracking-tight">
                        {book.title}
                      </h2>
                      {book.author && (
                        <p className="mt-0.5 truncate text-xs text-ink-soft">{book.author}</p>
                      )}
                      <div className="mt-3">
                        <div className="h-1 overflow-hidden rounded-full bg-paper-deep">
                          <div
                            className={cn("h-full rounded-full bg-accent transition-[width]")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-ink-soft">
                          {pct > 0
                            ? `${pct} % ${t("read")}`
                            : t("not started yet")}
                        </p>
                      </div>
                      {count > 0 && (
                        <p className="mt-1.5 font-mono text-[10px] text-ink-soft">
                          {count} {t("highlights")}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center justify-between border-t border-line px-4 py-2">
                  <Link
                    href={`/read?b=${book.id}`}
                    className="font-mono text-[11px] tracking-wide text-accent uppercase transition-colors hover:text-ink"
                  >
                    {book.lastReadAt ? t("Continue") : t("Start reading")}
                  </Link>
                  <button
                    className="btn-icon size-7 text-ink-soft hover:text-marker"
                    aria-label={t("Delete")}
                    onClick={() => void removeBook(book.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 font-mono text-[10px] leading-relaxed text-ink-soft">
        {t("EPUB files stay on this device (IndexedDB) - position, highlights and comments live in your Semester data.")}
      </p>
    </div>
  );
}
