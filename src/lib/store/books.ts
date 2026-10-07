"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "../utils";

/**
 * Books for the EPUB reader: metadata + last reading position + highlights.
 * The EPUB files themselves live in IndexedDB (books-db) — this store only
 * carries the small, restorable data. All local to this device.
 */

export type HighlightColor = "yellow" | "green" | "blue" | "rose";

export const HIGHLIGHT_COLORS: Array<{ id: HighlightColor; label: string; hex: string }> = [
  { id: "yellow", label: "Gelb", hex: "#e8c559" },
  { id: "green", label: "Grün", hex: "#9dc08b" },
  { id: "blue", label: "Blau", hex: "#92b4d5" },
  { id: "rose", label: "Rosa", hex: "#db9aab" },
];

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  /** data URL cover extracted at import time */
  cover?: string;
  addedAt: number;
  /** last reading position — exact CFI plus a rough percentage for lists */
  cfi?: string;
  percentage?: number;
  lastReadAt?: number;
}

export interface BookHighlight {
  id: string;
  bookId: string;
  /** CFI range — survives font size and layout changes */
  cfiRange: string;
  color: HighlightColor;
  /** the selected text, for the notes list */
  text: string;
  comment?: string;
  createdAt: number;
}

interface BooksState {
  books: BookMeta[];
  highlights: BookHighlight[];
  addBook: (meta: Omit<BookMeta, "id" | "addedAt">) => string;
  removeBook: (id: string) => void;
  setProgress: (id: string, cfi: string, percentage: number) => void;
  addHighlight: (h: Omit<BookHighlight, "id" | "createdAt">) => string;
  updateHighlight: (id: string, patch: Partial<Pick<BookHighlight, "color" | "comment">>) => void;
  removeHighlight: (id: string) => void;
}

export const useBooksStore = create<BooksState>()(
  persist(
    (set) => ({
      books: [],
      highlights: [],
      addBook: (meta) => {
        const id = uid();
        set((s) => ({ books: [...s.books, { ...meta, id, addedAt: Date.now() }] }));
        return id;
      },
      removeBook: (id) =>
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          highlights: s.highlights.filter((h) => h.bookId !== id),
        })),
      setProgress: (id, cfi, percentage) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id ? { ...b, cfi, percentage, lastReadAt: Date.now() } : b,
          ),
        })),
      addHighlight: (h) => {
        const id = uid();
        set((s) => ({ highlights: [...s.highlights, { ...h, id, createdAt: Date.now() }] }));
        return id;
      },
      updateHighlight: (id, patch) =>
        set((s) => ({
          highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),
      removeHighlight: (id) =>
        set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),
    }),
    { name: "semester.books", version: 1 },
  ),
);
