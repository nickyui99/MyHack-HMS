import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useActiveCase } from '@/lib/activeCase';
import { HAS_CHAT } from '@/lib/env';
import {
  createSession,
  streamMessage,
  type AdkEvent,
  type AdkSession,
} from './adkClient';
import type { A2UIComponent, A2UISurfaceState } from './a2uiTypes';

export type ChatMessage =
  | {
      id: string;
      kind: 'text';
      role: 'user' | 'assistant' | 'system';
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      kind: 'surface';
      role: 'assistant';
      surfaceId: string;
      createdAt: number;
    };

interface ChatCtx {
  enabled: boolean;
  open: boolean;
  isStreaming: boolean;
  error: string | null;
  messages: ChatMessage[];
  surfaces: Record<string, A2UISurfaceState>;
  toggle: () => void;
  openPanel: () => void;
  closePanel: () => void;
  send: (text: string, extraContext?: Record<string, unknown>) => Promise<void>;
  // Mutate the data model of a rendered surface (used by ChoicePicker/TextField).
  setSurfaceData: (surfaceId: string, path: string, value: unknown) => void;
  clear: () => void;
}

// Dotted-path read/write helpers for A2UI data bindings ("picks.cardiothoracic_surgeon").
function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path || path === '/' || path === '') return obj;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  // path "/" or "" replaces the whole model.
  if (!path || path === '/' || path === '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }
    return {};
  }
  const parts = path.split('.');
  const next: Record<string, unknown> = { ...obj };
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const existing = cur[key];
    cur[key] = {
      ...(existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {}),
    };
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

export { getAtPath, setAtPath };

const Ctx = createContext<ChatCtx | null>(null);

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { active } = useActiveCase();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [surfaces, setSurfaces] = useState<Record<string, A2UISurfaceState>>({});
  const [isStreaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<AdkSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ensureSession = useCallback(async (): Promise<AdkSession> => {
    if (sessionRef.current) return sessionRef.current;
    const s = await createSession();
    sessionRef.current = s;
    return s;
  }, []);

  const applyEvent = useCallback(
    (assistantId: string, ev: AdkEvent) => {
      if (ev.kind === 'text') {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === assistantId);
          if (idx === -1) {
            return [
              ...prev,
              {
                id: assistantId,
                kind: 'text',
                role: 'assistant',
                text: ev.delta,
                createdAt: Date.now(),
              },
            ];
          }
          const current = prev[idx];
          if (current.kind !== 'text') return prev;
          const next = prev.slice();
          next[idx] = { ...current, text: current.text + ev.delta };
          return next;
        });
        return;
      }

      if (ev.kind === 'createSurface') {
        setSurfaces((prev) => ({
          ...prev,
          [ev.payload.surfaceId]: {
            surfaceId: ev.payload.surfaceId,
            catalogId: ev.payload.catalogId,
            components: prev[ev.payload.surfaceId]?.components ?? {},
            data: prev[ev.payload.surfaceId]?.data ?? {},
          },
        }));
        setMessages((prev) => {
          if (prev.some((m) => m.kind === 'surface' && m.surfaceId === ev.payload.surfaceId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: uid('surface'),
              kind: 'surface',
              role: 'assistant',
              surfaceId: ev.payload.surfaceId,
              createdAt: Date.now(),
            },
          ];
        });
        return;
      }

      if (ev.kind === 'updateComponents') {
        setSurfaces((prev) => {
          const existing = prev[ev.payload.surfaceId] ?? {
            surfaceId: ev.payload.surfaceId,
            components: {} as Record<string, A2UIComponent>,
            data: {},
          };
          const nextComponents = { ...existing.components };
          for (const c of ev.payload.components) {
            nextComponents[c.id] = c;
          }
          return {
            ...prev,
            [ev.payload.surfaceId]: {
              ...existing,
              components: nextComponents,
              data: existing.data ?? {},
            },
          };
        });
        setMessages((prev) => {
          if (prev.some((m) => m.kind === 'surface' && m.surfaceId === ev.payload.surfaceId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: uid('surface'),
              kind: 'surface',
              role: 'assistant',
              surfaceId: ev.payload.surfaceId,
              createdAt: Date.now(),
            },
          ];
        });
        return;
      }

      if (ev.kind === 'updateDataModel') {
        setSurfaces((prev) => {
          const existing = prev[ev.payload.surfaceId] ?? {
            surfaceId: ev.payload.surfaceId,
            components: {} as Record<string, A2UIComponent>,
            data: {},
          };
          const nextData = setAtPath(existing.data ?? {}, ev.payload.path, ev.payload.value);
          return {
            ...prev,
            [ev.payload.surfaceId]: { ...existing, data: nextData },
          };
        });
        return;
      }

      if (ev.kind === 'error') {
        setError(ev.message);
        setMessages((prev) => [
          ...prev,
          {
            id: uid('err'),
            kind: 'text',
            role: 'system',
            text: ev.message,
            createdAt: Date.now(),
          },
        ]);
      }
    },
    [],
  );

  const send = useCallback(
    async (text: string, extraContext?: Record<string, unknown>) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      if (!HAS_CHAT) {
        setError('Chat backend not configured (VITE_ADK_BASE_URL).');
        return;
      }
      setError(null);

      const userMsg: ChatMessage = {
        id: uid('u'),
        kind: 'text',
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const assistantId = uid('a');
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const session = await ensureSession();
        const stream = streamMessage({
          session,
          text: trimmed,
          context: {
            case_id: active.adkCaseId ?? active.id,
            ...(extraContext ?? {}),
          },
          signal: ctrl.signal,
        });
        for await (const ev of stream) {
          if (ev.kind === 'done') break;
          applyEvent(assistantId, ev);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setMessages((prev) => [
          ...prev,
          {
            id: uid('err'),
            kind: 'text',
            role: 'system',
            text: message,
            createdAt: Date.now(),
          },
        ]);
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [active.id, applyEvent, ensureSession, isStreaming],
  );

  const setSurfaceData = useCallback(
    (surfaceId: string, path: string, value: unknown) => {
      setSurfaces((prev) => {
        const existing = prev[surfaceId];
        if (!existing) return prev;
        const nextData = setAtPath(existing.data ?? {}, path, value);
        return {
          ...prev,
          [surfaceId]: { ...existing, data: nextData },
        };
      });
    },
    [],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current = null;
    setMessages([]);
    setSurfaces({});
    setError(null);
    setStreaming(false);
  }, []);

  const value = useMemo<ChatCtx>(
    () => ({
      enabled: HAS_CHAT,
      open,
      isStreaming,
      error,
      messages,
      surfaces,
      toggle: () => setOpen((v) => !v),
      openPanel: () => setOpen(true),
      closePanel: () => setOpen(false),
      send,
      setSurfaceData,
      clear,
    }),
    [open, isStreaming, error, messages, surfaces, send, setSurfaceData, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat(): ChatCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChat must be used inside <ChatProvider>');
  return v;
}
