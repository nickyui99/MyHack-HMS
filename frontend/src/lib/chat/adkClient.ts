/**
 * Thin client for the ADK api_server.
 *
 * Two operations:
 *   - createSession(): POST /apps/{app}/users/{user}/sessions/{sessionId}
 *   - streamMessage(): POST /run_sse, returns an async iterable of parsed events.
 *
 * The /run_sse stream emits `text/event-stream` chunks. EventSource doesn't
 * support POST, so we use fetch + a ReadableStream reader and split on `\n\n`.
 *
 * Each ADK event is JSON with an `author` and `content.parts[]`. A part can be:
 *   - { text: string }                      → text delta to append to the assistant turn.
 *   - { function_call: { name, args } }     → A2UI surface update (args carries createSurface or updateComponents).
 *   - { function_response: { ... } }        → tool result; we surface as a system note.
 *
 * We tolerate variations in field naming (snake_case vs camelCase) since A2UI
 * envelopes are sometimes nested inside `args.payload` vs `args` directly.
 */

import {
  ADK_APP_NAME,
  ADK_BASE_URL,
  ADK_PERSONA_USER_ID,
} from '@/lib/env';
import type {
  A2UIComponent,
  A2UICreateSurface,
  A2UIEnvelope,
  A2UIUpdateComponents,
  A2UIUpdateDataModel,
} from './a2uiTypes';

export interface AdkSession {
  appName: string;
  userId: string;
  sessionId: string;
}

export type AdkEvent =
  | { kind: 'text'; delta: string }
  | { kind: 'createSurface'; payload: A2UICreateSurface }
  | { kind: 'updateComponents'; payload: A2UIUpdateComponents }
  | { kind: 'updateDataModel'; payload: A2UIUpdateDataModel }
  | { kind: 'tool'; name: string; output: unknown }
  | { kind: 'error'; message: string }
  | { kind: 'done' };

const DEFAULT_SESSION_BODY = {
  state: {},
  events: [],
};

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `sess-${crypto.randomUUID()}`;
  }
  return `sess-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createSession(
  init: { userId?: string; appName?: string } = {},
): Promise<AdkSession> {
  if (!ADK_BASE_URL) {
    throw new Error('ADK_BASE_URL not configured');
  }
  const appName = init.appName ?? ADK_APP_NAME;
  const userId = init.userId ?? ADK_PERSONA_USER_ID;
  const sessionId = newSessionId();
  const url = `${ADK_BASE_URL}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(
    userId,
  )}/sessions/${encodeURIComponent(sessionId)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEFAULT_SESSION_BODY),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ADK createSession ${res.status}: ${text || res.statusText}`);
  }
  return { appName, userId, sessionId };
}

interface StreamMessageInput {
  session: AdkSession;
  text: string;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}

export async function* streamMessage(
  input: StreamMessageInput,
): AsyncGenerator<AdkEvent, void, void> {
  if (!ADK_BASE_URL) {
    yield { kind: 'error', message: 'ADK_BASE_URL not configured' };
    yield { kind: 'done' };
    return;
  }

  const body = {
    app_name: input.session.appName,
    user_id: input.session.userId,
    session_id: input.session.sessionId,
    new_message: {
      role: 'user',
      parts: [{ text: maybeAttachContext(input.text, input.context) }],
    },
    streaming: true,
  };

  const res = await fetch(`${ADK_BASE_URL}/run_sse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    yield { kind: 'error', message: `ADK /run_sse ${res.status}: ${text || res.statusText}` };
    yield { kind: 'done' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  // Cross-event buffer for <a2ui-json>...</a2ui-json> blocks that may span
  // multiple text deltas (rare with the current ADK, but cheap to support).
  let textBuf = '';

  function* expand(ev: AdkEvent): Generator<AdkEvent> {
    if (ev.kind !== 'text') {
      yield ev;
      return;
    }
    const { events, remaining } = splitTextForA2UI(textBuf, ev.delta, false);
    textBuf = remaining;
    for (const e of events) yield e;
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep = buf.indexOf('\n\n');
      while (sep !== -1) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        sep = buf.indexOf('\n\n');

        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart());
        if (dataLines.length === 0) continue;
        const payload = dataLines.join('\n');
        if (payload === '[DONE]') {
          // Flush any buffered text/surface before signalling done.
          const tail = splitTextForA2UI(textBuf, '', true);
          textBuf = '';
          for (const e of tail.events) yield e;
          yield { kind: 'done' };
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          for (const e of expand({ kind: 'text', delta: payload })) yield e;
          continue;
        }

        for (const ev of normalizeEvent(parsed)) {
          for (const e of expand(ev)) yield e;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  // End-of-stream flush.
  const tail = splitTextForA2UI(textBuf, '', true);
  textBuf = '';
  for (const e of tail.events) yield e;
  yield { kind: 'done' };
}

// A2UI tag extractor — splits text deltas around <a2ui-json>...</a2ui-json>
// blocks. When passed flush=false it holds a small tail in case a tag was
// split across chunks; flush=true emits everything left in the buffer.
const A2UI_OPEN_TAG = '<a2ui-json>';
const A2UI_CLOSE_TAG = '</a2ui-json>';

function stripJsonFences(s: string): string {
  let v = s.trim();
  if (v.startsWith('```json')) v = v.slice(7).trim();
  else if (v.startsWith('```')) v = v.slice(3).trim();
  if (v.endsWith('```')) v = v.slice(0, -3).trim();
  return v;
}

function splitTextForA2UI(
  buf: string,
  delta: string,
  flush: boolean,
): { events: AdkEvent[]; remaining: string } {
  let work = buf + delta;
  const events: AdkEvent[] = [];

  while (true) {
    const openIdx = work.indexOf(A2UI_OPEN_TAG);
    if (openIdx === -1) {
      // No (more) open tags in this buffer. ADK's a2ui parser pairs the text
      // right *before* each <a2ui-json> block with the block itself as a
      // fallback for non-A2UI clients (`a2ui/parser/parser.py:80`:
      // ResponsePart(text=text_part, a2ui_json=json_data)). Since we render
      // the surface, that fallback text is duplicate.
      //
      // We can't know if a tag is coming in a later chunk, so we buffer text
      // here and only emit it on flush (end of stream) — at which point we
      // know it was trailing standalone text, not a block fallback. Cost:
      // plain-text replies appear at end-of-turn instead of token-by-token.
      // ADK already delivers in large chunks, so the latency is minimal.
      if (flush && work) {
        events.push({ kind: 'text', delta: work });
        work = '';
      }
      break;
    }

    // Open tag found. The text before it is the surface's text fallback —
    // drop it so we don't render it twice (once as plain text, once inside
    // the rendered Card).
    work = work.slice(openIdx);

    const closeIdx = work.indexOf(A2UI_CLOSE_TAG, A2UI_OPEN_TAG.length);
    if (closeIdx === -1) {
      // Incomplete block — wait for more.
      break;
    }

    const inner = work.slice(A2UI_OPEN_TAG.length, closeIdx);
    work = work.slice(closeIdx + A2UI_CLOSE_TAG.length);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(inner));
    } catch {
      // Malformed JSON — surface as text so something is visible.
      events.push({ kind: 'text', delta: `${A2UI_OPEN_TAG}${inner}${A2UI_CLOSE_TAG}` });
      continue;
    }

    const envelopes = Array.isArray(parsed) ? parsed : [parsed];
    for (const env of envelopes) {
      if (!env || typeof env !== 'object') continue;
      const e = env as Record<string, unknown>;
      if (e.createSurface) {
        events.push({
          kind: 'createSurface',
          payload: e.createSurface as A2UICreateSurface,
        });
      }
      if (e.updateComponents) {
        const u = e.updateComponents as Record<string, unknown>;
        events.push({
          kind: 'updateComponents',
          payload: {
            surfaceId: String(u.surfaceId ?? ''),
            components: Array.isArray(u.components)
              ? (u.components as A2UIComponent[])
              : [],
          },
        });
      }
      if (e.updateDataModel) {
        const d = e.updateDataModel as Record<string, unknown>;
        events.push({
          kind: 'updateDataModel',
          payload: {
            surfaceId: String(d.surfaceId ?? ''),
            path: typeof d.path === 'string' ? d.path : '/',
            value: d.value,
          },
        });
      }
    }
  }

  return { events, remaining: work };
}

function maybeAttachContext(
  text: string,
  context?: Record<string, unknown>,
): string {
  if (!context || Object.keys(context).length === 0) return text;
  const ctxLine = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' · ');
  if (!ctxLine) return text;
  return `${text}\n\n[context] ${ctxLine}`;
}

function normalizeEvent(raw: unknown): AdkEvent[] {
  const out: AdkEvent[] = [];
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;

  // ADK shape: { content: { parts: [...] }, ... }
  const content = obj.content as Record<string, unknown> | undefined;
  const parts = (content?.parts ?? obj.parts) as unknown[] | undefined;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (!p || typeof p !== 'object') continue;
      const part = p as Record<string, unknown>;

      if (typeof part.text === 'string' && part.text.length > 0) {
        out.push({ kind: 'text', delta: part.text });
        continue;
      }

      const fnCall = (part.function_call ?? part.functionCall) as
        | Record<string, unknown>
        | undefined;
      if (fnCall && typeof fnCall === 'object') {
        const name = String(fnCall.name ?? 'tool');
        const args = (fnCall.args ?? fnCall.arguments) as
          | Record<string, unknown>
          | undefined;
        const env = extractA2UIEnvelopes(args);
        if (env.length > 0) {
          for (const e of env) {
            if (e.createSurface) {
              out.push({ kind: 'createSurface', payload: e.createSurface });
            }
            if (e.updateComponents) {
              out.push({
                kind: 'updateComponents',
                payload: {
                  surfaceId: e.updateComponents.surfaceId,
                  components: (e.updateComponents.components ?? []) as A2UIComponent[],
                },
              });
            }
            if (e.updateDataModel) {
              out.push({
                kind: 'updateDataModel',
                payload: e.updateDataModel,
              });
            }
          }
        } else {
          out.push({ kind: 'tool', name, output: args ?? null });
        }
        continue;
      }

      const fnResp = (part.function_response ?? part.functionResponse) as
        | Record<string, unknown>
        | undefined;
      if (fnResp && typeof fnResp === 'object') {
        out.push({
          kind: 'tool',
          name: String(fnResp.name ?? 'tool'),
          output: fnResp.response ?? fnResp.output ?? null,
        });
      }
    }
  }

  // Some ADK builds emit a top-level error string.
  if (typeof obj.error === 'string' && obj.error) {
    out.push({ kind: 'error', message: obj.error });
  }

  // Top-level A2UI envelope (when the agent streams surfaces outside function_call).
  const envs = extractA2UIEnvelopes(obj);
  for (const e of envs) {
    if (e.createSurface) out.push({ kind: 'createSurface', payload: e.createSurface });
    if (e.updateComponents) {
      out.push({
        kind: 'updateComponents',
        payload: {
          surfaceId: e.updateComponents.surfaceId,
          components: (e.updateComponents.components ?? []) as A2UIComponent[],
        },
      });
    }
    if (e.updateDataModel) {
      out.push({ kind: 'updateDataModel', payload: e.updateDataModel });
    }
  }

  return out;
}

function extractA2UIEnvelopes(args: unknown): A2UIEnvelope[] {
  if (!args) return [];
  const out: A2UIEnvelope[] = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    const obj = v as Record<string, unknown>;
    if (obj.createSurface || obj.updateComponents || obj.updateDataModel) {
      out.push({
        version: typeof obj.version === 'string' ? obj.version : undefined,
        createSurface: obj.createSurface as A2UICreateSurface | undefined,
        updateComponents: obj.updateComponents as A2UIUpdateComponents | undefined,
        updateDataModel: obj.updateDataModel as A2UIUpdateDataModel | undefined,
      });
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
    } else {
      for (const k of Object.keys(obj)) {
        // Don't recurse into giant component blobs we've already captured.
        if (k === 'components' || k === 'children') continue;
        visit(obj[k]);
      }
    }
  };
  visit(args);
  return out;
}
