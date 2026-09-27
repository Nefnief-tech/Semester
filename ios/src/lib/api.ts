/* Port of `lib/services/api.dart` — client for the Semester web server (the
 * Next.js app). The AI key and the school-portal scraper live there, so the
 * app reuses the same JWT-gated API routes as the web frontend. Chat streams
 * through expo/fetch, whose response body is a real ReadableStream. */

import { fetch as expoFetch } from 'expo/fetch';

import { Flashcard, PortalPlan, StudyDoc, flashcardFromJson, portalPlanFromJson, studyDocFromJson } from '../models/types';
import { getAuthHeaders, storageUploadFile } from './appwrite';
import { useAuthStore } from '../stores/auth_store';
import { usePortalStore } from '../stores/portal_store';
import { useSettingsStore } from '../stores/settings_store';
import { useStudyroomStore } from '../stores/studyroom_store';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function serverUrl(): string {
  return useSettingsStore.getState().serverUrl.replace(/\/+$/, '');
}

/** pulls a readable message out of an AI provider's error payload */
function summarizeProviderError(detail?: string | null): string {
  if (!detail) return '';
  try {
    const json = JSON.parse(detail) as Record<string, unknown>;
    if (json && typeof json === 'object') {
      const err = json.error;
      if (typeof err === 'string') return err;
      if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string') {
        return (err as Record<string, unknown>).message as string;
      }
    }
  } catch {}
  return detail.length > 160 ? detail.slice(0, 160) : detail;
}

function friendlyUploadError(code: string): string {
  const errors: Record<string, string> = {
    unsupported_type: 'Unsupported file type — use PDF, DOCX, PPTX, TXT or MD.',
    too_large: 'That file is larger than 20 MB.',
    extract_failed: "Couldn't read this file. Scanned PDFs without a text layer aren't supported.",
    no_text: 'No extractable text found in this file.',
    missing_file: 'Upload failed — try again.',
    auth_required: 'Sign in first — open Account in the top bar.',
  };
  return errors[code] ?? 'Upload failed — try again.';
}

function friendlyChatError(code: string, detail: string): string {
  if (code === 'not_configured') {
    return 'AI is not configured — set an API key in the server .env.local and restart it.';
  }
  if (code === 'auth_required') return 'Sign in first — open Account in the top bar.';
  if (detail) return `The AI provider rejected the request: ${detail}`;
  return 'Sorry, the AI provider returned an error. Please try again.';
}

/* ---------------- documents ---------------- */

export const SemesterApi = {
  /** lists the signed-in user's document metadata + whether AI is configured.
   * Never throws — an unreachable server just leaves the panels empty. */
  async refreshDocuments(): Promise<void> {
    try {
      const res = await fetch(`${serverUrl()}/api/study-room/documents`, {
        headers: await getAuthHeaders(),
      });
      if (res.status !== 200) return;
      const json = (await res.json()) as Record<string, unknown>;
      if (!json || typeof json !== 'object') return;
      const docs = (Array.isArray(json.documents) ? json.documents : [])
        .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
        .map(studyDocFromJson);
      useStudyroomStore.getState().setDocuments(docs, json.configured === true);

      // first visit: tick everything; afterwards prune stale selections
      const ids = docs.map((d) => d.id);
      const room = useStudyroomStore.getState();
      const current = room.selectedDocIds;
      const pruned = current.filter((id) => ids.includes(id));
      if (pruned.length === 0) {
        room.setSelectedDocs(ids);
      } else if (pruned.length !== current.length) {
        room.setSelectedDocs(pruned);
      }
    } catch {
      // server unreachable / signed out — the study room works without it
    }
  },

  /** upload one file: persist the raw file in the Appwrite bucket (best
   * effort), then extract text server-side. Returns the created StudyDoc. */
  async uploadDocument(fileUri: string, fileName: string): Promise<StudyDoc> {
    let bucketFileId: string | null = null;
    try {
      bucketFileId = await storageUploadFile(
        fileUri,
        fileName,
        useAuthStore.getState().user?.id ?? null,
      );
    } catch {
      // bucket not provisioned / offline — extraction still works locally
    }

    const form = new FormData();
    form.append('file', { uri: fileUri, name: fileName, type: 'application/octet-stream' } as unknown as Blob);
    if (bucketFileId) form.append('bucketFileId', bucketFileId);
    const res = await fetch(`${serverUrl()}/api/study-room/documents`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: form,
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {}
    if (res.status !== 200 || !json || !('id' in json)) {
      const code = json ? String(json.error ?? '') : '';
      throw new ApiError(friendlyUploadError(code));
    }
    return studyDocFromJson(json);
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${serverUrl()}/api/study-room/documents/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    if (res.status !== 200) throw new ApiError('Delete failed — try again.');
  },

  /* ---------------- flashcards ---------------- */

  async generateFlashcards(documentIds: string[]): Promise<DeckSeed> {
    const res = await fetch(`${serverUrl()}/api/study-room/flashcards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ documentIds }),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {}
    const cardsRaw = json && Array.isArray(json.cards) ? json.cards : [];
    if (res.status !== 200 || !json || cardsRaw.length === 0) {
      const code = json ? String(json.error ?? 'generation_failed') : 'generation_failed';
      const detail = summarizeProviderError(json ? (json.detail as string | undefined) : undefined);
      if (code === 'not_configured') throw new ApiError('Add an API key to the server .env.local first.');
      if (code === 'auth_required') throw new ApiError('Sign in first — open Account in the top bar.');
      if (detail) throw new ApiError(`The AI provider rejected the request: ${detail}`);
      throw new ApiError(
        "The AI didn't return usable flashcards — try again or pick different documents.",
      );
    }
    return {
      title: typeof json.title === 'string' ? json.title : 'Flashcards',
      cards: cardsRaw
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map(flashcardFromJson),
    };
  },

  /* ---------------- chat (streaming) ---------------- */

  /** POSTs the chat and yields the assistant's accumulated content as deltas
   * arrive. The first line of the response is a JSON frame with the source
   * document names — surfaced with the first delta once parsed. */
  async *streamChat(options: {
    history: Array<{ role: string; content: string }>;
    documentIds: string[];
    signal?: AbortSignal;
  }): AsyncGenerator<ChatUpdate> {
    const res = await expoFetch(`${serverUrl()}/api/study-room/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        messages: options.history.map((m) => ({ role: m.role, content: m.content })),
        documentIds: options.documentIds,
      }),
      signal: options.signal,
    });

    if (res.status !== 200 || !res.body) {
      const body = res.body ? await res.text() : '';
      let json: Record<string, unknown> | null = null;
      try {
        json = body ? (JSON.parse(body) as Record<string, unknown>) : null;
      } catch {}
      const code = json ? String(json.error ?? '') : '';
      const detail = summarizeProviderError(json ? (json.detail as string | undefined) : undefined);
      yield { kind: 'error', message: friendlyChatError(code, detail) };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = '';
    let sources: string[] | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      if (sources === null) {
        const nl = raw.indexOf('\n');
        if (nl >= 0) {
          try {
            const frame = JSON.parse(raw.slice(0, nl)) as Record<string, unknown>;
            sources = Array.isArray(frame.sources) ? frame.sources.map(String) : [];
          } catch {
            sources = [];
          }
          raw = raw.slice(nl + 1);
          yield { kind: 'delta', content: raw, sources };
          continue;
        }
      } else {
        yield { kind: 'delta', content: raw, sources };
      }
    }
  },

  /* ---------------- school portal ---------------- */

  async fetchPortalPlan(): Promise<PortalPlan> {
    const portal = usePortalStore.getState();
    const res = await fetch(`${serverUrl()}/api/portal/fetch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        baseUrl: portal.baseUrl,
        username: portal.username,
        password: portal.password,
      }),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {}
    if (res.status !== 200 || !json || !('days' in json)) {
      const code = json ? String(json.error ?? 'portal_unreachable') : 'portal_unreachable';
      const detail = json && typeof json.detail === 'string' ? json.detail : '';
      if (code === 'portal_auth') {
        throw new ApiError('Portal rejected the login — check portal URL, email and password.');
      }
      if (code === 'auth_required') throw new ApiError('Sign in first — open Account in the top bar.');
      if (code === 'missing_settings') throw new ApiError('Fill in portal URL, email and password below.');
      throw new ApiError(detail || 'The portal could not be reached.');
    }
    return portalPlanFromJson(json);
  },
};

export interface DeckSeed {
  title: string;
  cards: Flashcard[];
}

export type ChatUpdate =
  | { kind: 'delta'; content: string; sources?: string[] }
  | { kind: 'error'; message: string };
