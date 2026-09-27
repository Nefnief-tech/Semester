/* Port of `lib/stores/studyroom_store.dart`. */

import { create } from 'zustand';
import { PersistOptions } from 'zustand/middleware';

import {
  ChatMessage,
  chatMessageFromJson,
  chatMessageToJson,
  Deck,
  deckFromJson,
  deckToJson,
  Flashcard,
  StudyDoc,
} from '../models/types';
import { uid } from '../utils/utils';
import { appStorage, persist, safeMerge } from './base';

interface StudyroomState {
  /** server-side document metadata — refetched on mount, NOT persisted */
  documents: StudyDoc[];
  configured: boolean;
  /** which documents feed flashcards & chat */
  selectedDocIds: string[];
  decks: Deck[];
  /** decks deleted while a cloud sync was unavailable/pending */
  deletedDeckIds: string[];
  chat: ChatMessage[];

  // -- documents (server-backed, not persisted) --
  setDocuments: (documents: StudyDoc[], configured: boolean) => void;
  addDocument: (doc: StudyDoc) => void;
  removeDocument: (id: string) => void;

  // -- selection --
  toggleSelectedDoc: (id: string) => void;
  setSelectedDocs: (ids: string[]) => void;

  // -- decks --
  addDeck: (input: { title: string; documentIds: string[]; cards: Flashcard[] }) => Deck;
  removeDeck: (id: string) => void;
  /** removes a deck deleted on ANOTHER device — no deletion marker */
  removeDeckSilently: (id: string) => void;
  upsertDeck: (deck: Deck) => void;
  clearDeletedDeckIds: (ids: string[]) => void;

  // -- chat --
  appendMessage: (message: ChatMessage) => void;
  updateLastAssistant: (content: string, sources?: string[]) => void;
  upsertChatMessage: (message: ChatMessage) => void;
  removeChatMessage: (id: string) => void;
  clearChat: () => void;

  // -- cards (row-level sync) --
  upsertCard: (deckId: string, card: Flashcard) => void;
  removeCard: (deckId: string, cardId: string) => void;

  // -- selection (row-level sync) --
  upsertSelection: (docId: string) => void;
  removeSelection: (docId: string) => void;
}

export const useStudyroomStore = create<StudyroomState>()(
  persist<StudyroomState, [], [], Pick<StudyroomState, 'selectedDocIds' | 'decks' | 'deletedDeckIds' | 'chat'>>(
    (set, get) => ({
      documents: [],
      configured: false,
      selectedDocIds: [],
      decks: [],
      deletedDeckIds: [],
      chat: [],

      setDocuments: (documents, configured) => set({ documents, configured }),
      addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
      removeDocument: (id) =>
        set((s) => ({
          documents: s.documents.filter((d) => d.id !== id),
          selectedDocIds: s.selectedDocIds.filter((x) => x !== id),
        })),

      toggleSelectedDoc: (id) =>
        set((s) => ({
          selectedDocIds: s.selectedDocIds.includes(id)
            ? s.selectedDocIds.filter((x) => x !== id)
            : [...s.selectedDocIds, id],
        })),
      setSelectedDocs: (ids) => set({ selectedDocIds: ids }),

      addDeck: ({ title, documentIds, cards }) => {
        const now = Date.now();
        const full: Deck = { id: uid(), title, documentIds, createdAt: now, updatedAt: now, cards };
        set((s) => ({ decks: [full, ...s.decks] }));
        return full;
      },
      removeDeck: (id) =>
        set((s) => ({
          decks: s.decks.filter((d) => d.id !== id),
          deletedDeckIds: [...s.deletedDeckIds, id],
        })),
      removeDeckSilently: (id) => set((s) => ({ decks: s.decks.filter((d) => d.id !== id) })),
      upsertDeck: (deck) =>
        set((s) => ({ decks: [...s.decks.filter((d) => d.id !== deck.id), deck] })),
      clearDeletedDeckIds: (ids) =>
        set((s) => ({ deletedDeckIds: s.deletedDeckIds.filter((id) => !ids.includes(id)) })),

      appendMessage: (message) =>
        set((s) => ({
          chat: [
            ...s.chat,
            {
              role: message.role,
              content: message.content,
              sources: message.sources,
              id: message.id ?? uid(),
              sentAt: message.sentAt ?? Date.now(),
            },
          ],
        })),
      updateLastAssistant: (content, sources) => {
        const { chat } = get();
        if (chat.length === 0 || chat[chat.length - 1].role === 'user') return;
        const last = chat[chat.length - 1];
        const next = [...chat];
        next[next.length - 1] = { role: 'assistant', content, sources, id: last.id, sentAt: last.sentAt };
        set({ chat: next });
      },
      upsertChatMessage: (message) => {
        if (message.id == null) return;
        set((s) => ({ chat: [...s.chat.filter((m) => m.id !== message.id), message] }));
      },
      removeChatMessage: (id) => set((s) => ({ chat: s.chat.filter((m) => m.id !== id) })),
      clearChat: () => set({ chat: [] }),

      upsertCard: (deckId, card) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId ? { ...d, cards: [...d.cards.filter((c) => c.id !== card.id), card] } : d,
          ),
        })),
      removeCard: (deckId, cardId) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === deckId ? { ...d, cards: d.cards.filter((c) => c.id !== cardId) } : d,
          ),
        })),

      upsertSelection: (docId) =>
        set((s) =>
          s.selectedDocIds.includes(docId) ? s : { selectedDocIds: [...s.selectedDocIds, docId] },
        ),
      removeSelection: (docId) =>
        set((s) =>
          s.selectedDocIds.includes(docId)
            ? { selectedDocIds: s.selectedDocIds.filter((x) => x !== docId) }
            : s,
        ),
    }),
    {
      name: 'semester.studyroom',
      version: 2,
      storage: appStorage,
      partialize: (s: StudyroomState) => ({
        selectedDocIds: s.selectedDocIds,
        decks: s.decks.map(deckToJson),
        deletedDeckIds: s.deletedDeckIds,
        chat: s.chat.map(chatMessageToJson),
      }),
      merge: safeMerge((persisted: any, current: StudyroomState) => {
        const p = persisted as {
          selectedDocIds?: unknown;
          decks?: unknown[];
          deletedDeckIds?: unknown;
          chat?: unknown[];
        };
        return {
          ...current,
          selectedDocIds: Array.isArray(p.selectedDocIds) ? p.selectedDocIds.map(String) : [],
          decks: (p.decks ?? [])
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(deckFromJson),
          deletedDeckIds: Array.isArray(p.deletedDeckIds) ? p.deletedDeckIds.map(String) : [],
          chat: (p.chat ?? [])
            .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
            .map(chatMessageFromJson),
        };
      }),
    } as unknown as PersistOptions<
      StudyroomState,
      Pick<StudyroomState, 'selectedDocIds' | 'decks' | 'deletedDeckIds' | 'chat'>
    >,
  ),
);
