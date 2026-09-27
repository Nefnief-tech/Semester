/* Port of study-room/page.tsx + DocumentsPanel + FlashcardsPanel + ChatPanel
 * — upload material → generate flashcards → ask questions (streaming, with
 * cited sources). */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable as RNPressable, ScrollView, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import * as DocumentPicker from 'expo-document-picker';

import { Deck, DocKind, Flashcard, Tone } from '../models/types';
import { ApiError, SemesterApi } from '../lib/api';
import { SyncStatus, useAuthStore } from '../stores/auth_store';
import { useStudyroomStore } from '../stores/studyroom_store';
import { EmptyState, SemChip } from '../components/bits';
import { PageHeader, SemCard, SemGhostButton, SemIconButton, SemPrimaryButton, SemTextField } from '../components/controls';
import { Pressable } from '../components/motion';
import { usePaneWidth } from '../components/pane';
import { Icon } from '../components/Icon';
import { useSem } from '../theme/theme';
import { formatBytes, shuffle } from '../utils/utils';

type RoomTab = 'documents' | 'flashcards' | 'chat';

export function StudyRoomPage(): React.JSX.Element {
  const documents = useStudyroomStore((s) => s.documents);
  const decks = useStudyroomStore((s) => s.decks);
  const configured = useStudyroomStore((s) => s.configured);
  const [tab, setTab] = useState<RoomTab>('documents');
  const { c, t } = useSem();
  const width = usePaneWidth();
  const regular = width >= 768;
  const horizontalPadding = regular ? 40 : 16;

  useEffect(() => {
    void SemesterApi.refreshDocuments();
  }, []);

  const tabButton = (rt: RoomTab, icon: React.ComponentProps<typeof Icon>['name'], label: string, badge = 0) => {
    const selected = tab === rt;
    return (
      <Pressable
        key={rt}
        onPress={() => setTab(rt)}
        style={{
          flex: 1,
          paddingVertical: 9,
          borderRadius: 9,
          backgroundColor: selected ? c.ink : 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={15} color={selected ? c.paper : c.inkSoft} />
        <View style={{ width: 6 }} />
        <Text
          style={[t.bodySmall, { fontSize: 12, fontWeight: selected ? '500' : '400', color: selected ? c.paper : c.inkSoft }]}
        >
          {label}
        </Text>
        {badge > 0 ? (
          <View
            style={{
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 999,
              marginLeft: 6,
              backgroundColor: selected ? `${c.paper}33` : `${c.ink}1A`,
            }}
          >
            <Text style={[t.labelSmall, { fontSize: 10, color: selected ? c.paper : c.inkSoft }]}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <PageHeader
          title="Study Room"
          subtitle="upload material → generate flashcards → ask questions"
          trailing={
            <SemChip
              mono
              uppercase
              tone={(configured ? 'good' : 'warn') as Tone}
              text={configured ? 'AI ready' : 'AI key missing'}
              style={{ paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 }}
            />
          }
        />
        {/* tabs */}
        <View
          style={{
            flexDirection: 'row',
            padding: 4,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 12,
          }}
        >
          {tabButton('documents', 'description', 'Documents', documents.length)}
          {tabButton('flashcards', 'layers', 'Decks', decks.length)}
          {tabButton('chat', 'chat_bubble', 'Chat')}
        </View>
      </View>
      <View style={{ height: 16 }} />
      {tab === 'documents' ? <DocumentsTab /> : tab === 'flashcards' ? <FlashcardsTab /> : <ChatTab />}
    </View>
  );
}

/* ================================================================
   documents
   ================================================================ */

function DocumentsTab(): React.JSX.Element {
  const documents = useStudyroomStore((s) => s.documents);
  const selectedDocIds = useStudyroomStore((s) => s.selectedDocIds);
  const status = useAuthStore((s) => s.status);
  const { c, t } = useSem();
  const signedIn = status === 'signed-in';
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState('');

  const pickAndUpload = async () => {
    if (!signedIn) return;
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/markdown',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.canceled || res.assets.length === 0) return;
    const asset = res.assets[0];
    setError('');
    setUploading((u) => [...u, asset.name]);
    try {
      const doc = await SemesterApi.uploadDocument(asset.uri, asset.name);
      useStudyroomStore.getState().addDocument(doc);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed — is the server reachable?');
    } finally {
      setUploading((u) => u.filter((n) => n !== asset.name));
    }
  };

  const kindIcon = (kind: DocKind): React.ComponentProps<typeof Icon>['name'] =>
    kind === 'pptx' ? 'slideshow' : kind === 'txt' || kind === 'md' ? 'sticky_note_2' : 'description';

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
      {/* upload zone */}
      <Pressable
        onPress={pickAndUpload}
        disabled={!signedIn}
        style={{
          paddingHorizontal: 24,
          paddingVertical: 32,
          backgroundColor: c.card,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: c.line,
          alignItems: 'center',
        }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="upload" size={20} color={c.accent} />
        </View>
        <View style={{ height: 10 }} />
        <Text style={t.headlineSmall}>Drop your material here</Text>
        <View style={{ height: 4 }} />
        <Text style={[t.bodySmall, { textAlign: 'center' }]}>
          PDFs, slides (PPTX), DOCX or plain notes (TXT/MD) · up to 20 MB
        </Text>
      </Pressable>
      {error ? (
        <>
          <View style={{ height: 10 }} />
          <Text style={{ color: c.marker, fontSize: 13 }}>{error}</Text>
        </>
      ) : null}
      {!signedIn ? (
        <>
          <View style={{ height: 10 }} />
          <View
            style={{
              padding: 10,
              backgroundColor: `${c.amber}1A`,
              borderWidth: 1,
              borderColor: `${c.amber}66`,
              borderRadius: 8,
            }}
          >
            <Text style={[t.bodySmall, { color: c.inkSoft }]}>
              Not signed in — uploads need an account, so your files stay private. Open Account in the top bar.
            </Text>
          </View>
        </>
      ) : null}
      {uploading.length > 0 ? (
        <>
          <View style={{ height: 10 }} />
          <Text style={t.labelSmall}>extracting text · {uploading.join(', ')}…</Text>
        </>
      ) : null}
      <View style={{ height: 18 }} />

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          hint="Upload lecture notes, slides or chapters — they become the context for flashcards and chat."
        />
      ) : (
        <>
          <Text style={t.labelSmall}>
            {selectedDocIds.length} of {documents.length} selected as AI context
          </Text>
          <View style={{ height: 8 }} />
          {selectedDocIds.length < documents.length ? (
            <View style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <SemGhostButton onPress={() => useStudyroomStore.getState().setSelectedDocs(documents.map((d) => d.id))}>
                <Text style={[t.bodySmall, { fontSize: 12 }]}>Select all</Text>
              </SemGhostButton>
            </View>
          ) : null}
          {documents.map((doc) => {
            const selected = selectedDocIds.includes(doc.id);
            const uploaded = new Date(doc.uploadedAt);
            return (
              <View
                key={doc.id}
                style={{
                  marginBottom: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: selected ? `${c.accent}80` : c.line,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {/* selection checkbox */}
                <Pressable
                  onPress={() => useStudyroomStore.getState().toggleSelectedDoc(doc.id)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 1,
                    backgroundColor: selected ? c.accent : 'transparent',
                    borderColor: selected ? c.accent : `${c.ink}4D`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? (
                    <Text style={{ fontFamily: 'MaterialSymbolsOutlined', fontSize: 12, lineHeight: 12, color: c.paper }}>
                      {'\ue668'}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={{ width: 10 }} />
                <Icon name={kindIcon(doc.kind)} size={16} color={c.inkSoft} />
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[t.bodyMedium, { fontWeight: '500' }]}>
                    {doc.name}
                  </Text>
                  <Text style={t.labelSmall}>
                    {formatBytes(doc.size)} · {doc.chars} chars · {uploaded.getDate()}.{uploaded.getMonth()}.
                  </Text>
                </View>
                <SemIconButton
                  icon="delete"
                  size={16}
                  onPress={() => {
                    useStudyroomStore.getState().removeDocument(doc.id);
                    SemesterApi.deleteDocument(doc.id).catch(() => {});
                  }}
                />
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

/* ================================================================
   flashcards
   ================================================================ */

function FlashcardsTab(): React.JSX.Element {
  const decks = useStudyroomStore((s) => s.decks);
  const selectedDocIds = useStudyroomStore((s) => s.selectedDocIds);
  const configured = useStudyroomStore((s) => s.configured);
  const status = useAuthStore((s) => s.status);
  const { c, t } = useSem();
  const signedIn = status === 'signed-in';

  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // study state
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [seenDeckId, setSeenDeckId] = useState<string | null | undefined>(undefined);

  const deck: Deck | undefined = decks.find((d) => d.id === activeDeckId) ?? decks[0];

  const resetStudy = useCallback((d?: Deck) => {
    setOrder(shuffle(Array.from({ length: d?.cards.length ?? 0 }, (_, i) => i)));
    setPos(0);
    setFlipped(false);
    setKnown(new Set());
    setSeenDeckId(d?.id ?? null);
  }, []);

  useEffect(() => {
    if (seenDeckId !== (deck?.id ?? null)) resetStudy(deck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck?.id, resetStudy]);

  const generate = async () => {
    if (selectedDocIds.length === 0) return;
    setGenerating(true);
    setError('');
    try {
      const seed = await SemesterApi.generateFlashcards([...selectedDocIds]);
      const created = useStudyroomStore
        .getState()
        .addDeck({ title: seed.title, documentIds: [...selectedDocIds], cards: seed.cards });
      setActiveDeckId(created.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the AI provider.');
    } finally {
      setGenerating(false);
    }
  };

  if (!signedIn) return <AuthRequiredNotice feature="generate flashcards" />;
  if (!configured) return <SetupNotice />;

  if (decks.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <EmptyState
          icon="layers"
          title="No decks yet"
          hint={
            selectedDocIds.length > 0
              ? 'Turn your selected documents into a deck of flashcards.'
              : 'Upload material first and tick it as AI context — then generate your deck.'
          }
          action={
            <SemPrimaryButton
              disabled={generating || selectedDocIds.length === 0}
              onPress={generate}
            >
              <Text style={[t.bodyMedium, { color: '#F5F2EA', fontWeight: '500' }]}>
                {generating
                  ? '…'
                  : `Generate from ${selectedDocIds.length} ${selectedDocIds.length === 1 ? 'document' : 'documents'}`}
              </Text>
            </SemPrimaryButton>
          }
        />
        {error ? (
          <>
            <View style={{ height: 10 }} />
            <Text style={{ color: c.marker, textAlign: 'center' }}>{error}</Text>
          </>
        ) : null}
      </ScrollView>
    );
  }

  if (!deck) return <View />;
  const card: Flashcard | null = order.length === 0 || pos >= order.length ? null : deck.cards[order[pos]];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
      {/* deck header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {decks.length > 1 ? (
          <View style={{ flex: 1 }}>
            <Text style={t.headlineSmall}>{deck.title} · {deck.cards.length} cards</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {decks.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setActiveDeckId(d.id)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    borderWidth: 1,
                    marginRight: 6,
                    borderColor: d.id === deck.id ? c.ink : c.line,
                    backgroundColor: d.id === deck.id ? c.ink : c.paper,
                  }}
                >
                  <Text style={[t.bodySmall, { fontSize: 11, color: d.id === deck.id ? c.paper : c.ink }]} numberOfLines={1}>
                    {d.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <Text style={[t.headlineSmall, { flex: 1 }]}>{deck.title}</Text>
        )}
        <SemGhostButton disabled={generating} onPress={generate}>
          {generating ? (
            <Text style={t.bodyMedium}>…</Text>
          ) : (
            <>
              <Icon name="add" size={15} />
              <View style={{ width: 5 }} />
              <Text style={t.bodyMedium}>New deck</Text>
            </>
          )}
        </SemGhostButton>
        <SemIconButton icon="delete" onPress={() => useStudyroomStore.getState().removeDeck(deck.id)} />
      </View>
      <View style={{ height: 14 }} />

      {card ? (
        <>
          {/* flip card */}
          <Pressable onPress={() => setFlipped(!flipped)}>
            <View
              style={{
                height: 300,
                padding: 28,
                backgroundColor: flipped ? c.accentSoft : c.card,
                borderWidth: 1,
                borderColor: flipped ? `${c.accent}66` : c.line,
                borderRadius: 16,
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  t.labelSmall,
                  { letterSpacing: 1.4, color: flipped ? c.accent : c.inkSoft },
                ]}
              >
                {flipped ? 'ANSWER' : 'QUESTION'}
              </Text>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={[flipped ? t.bodyLarge : t.headlineSmall, { fontSize: flipped ? undefined : 22, textAlign: 'center' }]}>
                    {flipped ? card.back : card.front}
                  </Text>
                </ScrollView>
              </View>
              <Text style={[t.labelSmall, { color: flipped ? c.accent : c.inkSoft }]}>tap to flip</Text>
            </View>
          </Pressable>
          <View style={{ height: 14 }} />
          {/* progress */}
          <View style={{ height: 6, borderRadius: 999, backgroundColor: c.paperDeep, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: deck.cards.length === 0 ? '0%' : `${(known.size / deck.cards.length) * 100}%`,
                backgroundColor: c.accent,
              }}
            />
          </View>
          <View style={{ height: 14 }} />
          {/* controls */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <SemIconButton
              icon="chevron_left"
              disabled={pos === 0}
              onPress={() => {
                setFlipped(false);
                setPos(Math.max(0, pos - 1));
              }}
            />
            <Text style={[t.labelMedium, { textAlign: 'center', flex: 1, minWidth: 120 }]}>
              {pos + 1} / {deck.cards.length} · {known.size} known
            </Text>
            <SemIconButton icon="shuffle" onPress={() => resetStudy(deck)} />
            <SemIconButton icon="restart_alt" onPress={() => setKnown(new Set())} />
            <SemGhostButton
              onPress={() => {
                const next = new Set(known);
                next.add(card.id);
                setKnown(next);
                setFlipped(false);
                setPos(Math.min(order.length - 1, pos + 1));
              }}
            >
              <Icon name="check" size={15} />
              <View style={{ width: 5 }} />
              <Text style={t.bodyMedium}>Known</Text>
            </SemGhostButton>
            <SemPrimaryButton
              disabled={pos >= order.length - 1}
              onPress={() => {
                setFlipped(false);
                setPos(pos + 1);
              }}
            >
              <Text style={[t.bodyMedium, { color: '#F5F2EA' }]}>Next</Text>
              <Icon name="chevron_right" size={16} color="#F5F2EA" />
            </SemPrimaryButton>
          </View>
        </>
      ) : (
        <EmptyState title="Empty deck" hint="This deck has no cards." />
      )}

      {error ? (
        <>
          <View style={{ height: 12 }} />
          <Text style={{ color: c.marker, textAlign: 'center' }}>{error}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

/* ================================================================
   chat
   ================================================================ */

function ChatTab(): React.JSX.Element {
  const chat = useStudyroomStore((s) => s.chat);
  const documents = useStudyroomStore((s) => s.documents);
  const selectedDocIds = useStudyroomStore((s) => s.selectedDocIds);
  const configured = useStudyroomStore((s) => s.configured);
  const status = useAuthStore((s) => s.status);
  const { c, t } = useSem();
  const signedIn = status === 'signed-in';

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [providerError, setProviderError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const listRef = useRef<ScrollView | null>(null);
  const streamingRef = useRef(false);
  streamingRef.current = streaming;

  if (!signedIn) return <AuthRequiredNotice feature="chat about your documents" />;
  if (!configured) return <SetupNotice />;

  const contextDocs = documents.filter((d) => selectedDocIds.includes(d.id));
  const contextChars = contextDocs.reduce((sum, d) => sum + d.chars, 0);

  const send = async () => {
    const room = useStudyroomStore.getState();
    const text = input.trim();
    if (!text || streamingRef.current) return;
    setProviderError('');
    setInput('');
    const prior = room.chat.map((m) => ({ role: m.role, content: m.content }));
    room.appendMessage({ role: 'user', content: text });
    room.appendMessage({ role: 'assistant', content: '' });

    const history = [...prior, { role: 'user', content: text }];
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreaming(true);
    try {
      for await (const update of SemesterApi.streamChat({
        history,
        documentIds: [...selectedDocIds],
        signal: controller.signal,
      })) {
        if (update.kind === 'delta') {
          useStudyroomStore.getState().updateLastAssistant(update.content, update.sources);
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
        } else {
          useStudyroomStore.getState().updateLastAssistant(update.message);
          setProviderError(update.message);
        }
      }
    } catch (e) {
      if (e instanceof ApiError) {
        useStudyroomStore.getState().updateLastAssistant(e.message);
      } else if (!controller.signal.aborted) {
        useStudyroomStore.getState().updateLastAssistant('Connection to the AI provider failed.');
        setProviderError('Connection to the AI provider failed.');
      }
    } finally {
      controllerRef.current = null;
      setStreaming(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* context bar */}
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
        <Text numberOfLines={1} style={[t.labelSmall, { flex: 1 }]}>
          context · {contextDocs.length} {contextDocs.length === 1 ? 'document' : 'documents'}
          {contextChars > 0 ? ` · ${Math.round(contextChars / 1000)}k chars` : ''}
        </Text>
        {chat.length > 0 ? (
          <RNPressable onPress={() => useStudyroomStore.getState().clearChat()} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="delete" size={12} color={c.inkSoft} />
            <View style={{ width: 3 }} />
            <Text style={[t.labelSmall, { fontSize: 10 }]}>CLEAR</Text>
          </RNPressable>
        ) : null}
      </View>
      <View style={{ height: 8 }} />
      {/* messages */}
      <View style={{ flex: 1, marginHorizontal: 16 }}>
        <View
          style={{
            flex: 1,
            padding: 14,
            backgroundColor: `${c.card}99`,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 16,
          }}
        >
          {chat.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chat_bubble" size={30} color={c.inkSoft} />
              <View style={{ height: 10 }} />
              <Text style={t.titleLarge}>Ask your documents</Text>
              <View style={{ height: 4 }} />
              <Text style={[t.bodySmall, { textAlign: 'center' }]}>
                {contextDocs.length > 0
                  ? `Questions about ${contextDocs[0].name}${
                      contextDocs.length > 1 ? ` and ${contextDocs.length - 1} more selected documents` : ''
                    } — answers cite their sources.`
                  : 'No documents selected — the assistant will answer from general knowledge. Tick some documents in the Documents tab to ground it.'}
              </Text>
            </View>
          ) : (
            <ScrollView ref={listRef} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}>
              {chat.map((m, i) => (
                <View
                  key={m.id ?? i}
                  style={{ flexDirection: 'row', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}
                >
                  <View
                    style={{
                      maxWidth: 420,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: m.role === 'user' ? c.ink : c.card,
                      borderWidth: m.role === 'user' ? 0 : 1,
                      borderColor: c.line,
                    }}
                  >
                    {m.role === 'user' ? (
                      <Text style={[t.bodyMedium, { color: c.paper }]}>{m.content}</Text>
                    ) : m.content ? (
                      <MarkdownBlock
                        data={m.content}
                        streaming={streaming && i === chat.length - 1}
                      />
                    ) : (
                      <TypingDots />
                    )}
                    {m.role !== 'user' && m.sources && m.sources.length > 0 ? (
                      <>
                        <View style={{ height: 8 }} />
                        <View style={{ height: 1, backgroundColor: c.line }} />
                        <View style={{ height: 6 }} />
                        <Text style={[t.labelSmall, { fontSize: 10 }]}>sources · {m.sources.join(', ')}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
      {providerError ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={{ color: c.marker, fontSize: 12 }}>provider error · {providerError}</Text>
        </View>
      ) : null}
      {/* composer */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <SemTextField
            value={input}
            multiline
            placeholder="Ask something about your material…"
            onChangeText={setInput}
            onSubmitEditing={() => void send()}
            submitBehavior="submit"
          />
        </View>
        <View style={{ width: 8 }} />
        {streaming ? (
          <SemGhostButton onPress={() => controllerRef.current?.abort()}>
            <Icon name="stop" size={16} />
          </SemGhostButton>
        ) : (
          <SemPrimaryButton disabled={input.trim().length === 0} onPress={() => void send()}>
            <Icon name="send" size={16} color="#F5F2EA" />
          </SemPrimaryButton>
        )}
      </View>
    </View>
  );
}

/** assistant markdown with a blinking cursor while streaming */
function MarkdownBlock({ data, streaming = false }: { data: string; streaming?: boolean }) {
  const { c, t } = useSem();
  return (
    <View>
      <Markdown
        style={{
          body: { color: c.ink, fontFamily: t.bodyMedium.fontFamily, fontSize: 14 },
          strong: { fontWeight: '600' },
          em: { fontStyle: 'italic' },
          link: { color: c.info },
          heading1: { ...t.titleLarge, color: c.ink },
          heading2: { ...t.titleMedium, color: c.ink },
          heading3: { ...t.titleSmall, color: c.ink },
          code_inline: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: c.ink, backgroundColor: `${c.paperDeep}` },
          fence: { fontFamily: 'IBM Plex Mono', fontSize: 11, color: c.ink, backgroundColor: `${c.paperDeep}` },
          blockquote: {
            borderColor: `${c.accent}80`,
            backgroundColor: 'transparent',
            marginLeft: 0,
            marginHorizontal: 0,
            paddingHorizontal: 10,
          },
          table: { borderWidth: 1, borderColor: c.line },
          th: { ...t.labelSmall, fontSize: 11, fontWeight: '600', color: c.ink },
          td: { ...t.labelSmall, fontSize: 11, color: c.inkSoft },
          hr: { backgroundColor: c.line },
          list_item: { marginBottom: 2 },
          bullet: { color: c.inkSoft },
        }}
      >
        {data}
      </Markdown>
      {streaming ? <Text style={{ color: c.accent }}>▍</Text> : null}
    </View>
  );
}

function TypingDots(): React.JSX.Element {
  const { c } = useSem();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => (v + 1) % 3), 320);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flexDirection: 'row' }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            marginRight: 4,
            backgroundColor: `${c.inkSoft}${['59', 'B3', '8C'][i === tick ? 1 : i === (tick + 1) % 3 ? 2 : 0]}`,
          }}
        />
      ))}
    </View>
  );
}

/* ---------------- notices ---------------- */

export function AuthRequiredNotice({ feature }: { feature: string }): React.JSX.Element {
  const { c, t } = useSem();
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View
        style={{
          padding: 24,
          backgroundColor: c.card,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.line,
          alignItems: 'center',
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="person" size={16} color={c.accent} />
        </View>
        <View style={{ height: 10 }} />
        <Text style={t.headlineSmall}>Sign in to {feature}</Text>
        <View style={{ height: 4 }} />
        <Text style={[t.bodySmall, { textAlign: 'center' }]}>
          AI features are tied to your account so your usage and documents stay private.
        </Text>
      </View>
    </ScrollView>
  );
}

function SetupNotice(): React.JSX.Element {
  const { c, t } = useSem();
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <SemCard padding={20}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="key" size={16} color={c.accent} />
          </View>
          <View style={{ width: 10 }} />
          <Text style={[t.headlineSmall, { flex: 1 }]}>AI is not configured yet</Text>
        </View>
        <View style={{ height: 10 }} />
        <Text style={[t.bodyMedium, { color: c.inkSoft, lineHeight: 21 }]}>
          Add an API key to the server .env.local to unlock this feature. Any OpenAI-compatible provider works — Z.ai,
          DeepSeek, OpenAI, OpenRouter or a local Ollama.
        </Text>
        <View style={{ height: 10 }} />
        <View style={{ padding: 12, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: 8 }}>
          <Text style={[t.labelMedium, { fontSize: 11, color: c.inkSoft, lineHeight: 18 }]}>
            {'AI_API_KEY=your-key-here\nAI_BASE_URL=https://api.z.ai/api/paas/v4\nAI_MODEL=glm-4.6'}
          </Text>
        </View>
      </SemCard>
    </ScrollView>
  );
}
