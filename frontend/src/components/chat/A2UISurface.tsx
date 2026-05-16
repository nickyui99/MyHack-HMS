import type {
  A2UIComponent,
  A2UIDataBinding,
  A2UIOption,
} from '@/lib/chat/a2uiTypes';
import { getAtPath, useChat } from '@/lib/chat/ChatContext';

interface Props {
  surfaceId: string;
}

/**
 * Renders an A2UI surface by walking the component tree starting at `root`.
 * Unknown components fall through to a div with `data-component` so future
 * component types are non-breaking.
 */
export default function A2UISurface({ surfaceId }: Props) {
  const { surfaces, send, setSurfaceData, isStreaming } = useChat();
  const surface = surfaces[surfaceId];
  if (!surface) return null;
  const root = surface.components['root'];
  if (!root) return null;

  const data = surface.data ?? {};

  // Button clicks become a fresh user turn. The user-visible message is just
  // the button label; the event name + structured context ride along in the
  // context channel. {path: "..."} references in the context resolve against
  // the surface's live data model so form values reach the agent.
  const handleAction = (
    label: string,
    eventName?: string,
    context?: Record<string, unknown>,
  ) => {
    if (isStreaming) return;
    const resolved = resolveContext(context, data);
    const merged: Record<string, unknown> = { ...resolved };
    if (eventName) merged.event = eventName;
    void send(label, merged);
  };

  const handleDataChange = (path: string, value: unknown) => {
    setSurfaceData(surfaceId, path, value);
  };

  return (
    <div className="paper p-4 text-sm">
      <Node
        id="root"
        surface={surface.components}
        data={data}
        onAction={handleAction}
        onDataChange={handleDataChange}
      />
    </div>
  );
}

interface NodeProps {
  id: string;
  surface: Record<string, A2UIComponent>;
  data: Record<string, unknown>;
  onAction: (
    label: string,
    eventName?: string,
    context?: Record<string, unknown>,
  ) => void;
  onDataChange: (path: string, value: unknown) => void;
}

function Node({ id, surface, data, onAction, onDataChange }: NodeProps) {
  const c = surface[id];
  if (!c) return null;

  switch (c.component) {
    case 'Column':
      return (
        <div className="flex flex-col gap-2">
          {(c.children ?? []).map((cid) => (
            <Node
              key={cid}
              id={cid}
              surface={surface}
              data={data}
              onAction={onAction}
              onDataChange={onDataChange}
            />
          ))}
        </div>
      );

    case 'Row':
      return (
        <div className="flex flex-row flex-wrap gap-2">
          {(c.children ?? []).map((cid) => (
            <Node
              key={cid}
              id={cid}
              surface={surface}
              data={data}
              onAction={onAction}
              onDataChange={onDataChange}
            />
          ))}
        </div>
      );

    case 'Card':
      return (
        <div className="paper p-3">
          {c.child ? (
            <Node
              id={c.child}
              surface={surface}
              data={data}
              onAction={onAction}
              onDataChange={onDataChange}
            />
          ) : null}
          {(c.children ?? []).map((cid) => (
            <Node
              key={cid}
              id={cid}
              surface={surface}
              data={data}
              onAction={onAction}
              onDataChange={onDataChange}
            />
          ))}
        </div>
      );

    case 'Text': {
      const text = c.text ?? '';
      const variant = c.variant ?? 'body';
      if (variant === 'h1' || variant === 'h2') {
        return <p className="display text-lg font-semibold text-ink">{text}</p>;
      }
      if (variant === 'h3') {
        return <p className="display text-[15px] font-semibold text-ink">{text}</p>;
      }
      if (variant === 'caption') {
        return <p className="text-[11px] uppercase tracking-[0.16em] text-ink-subtle">{text}</p>;
      }
      return <p className="text-[13px] leading-snug text-ink">{text}</p>;
    }

    case 'Button': {
      let label = '';
      if (c.child) {
        const labelNode = surface[c.child];
        if (labelNode?.text) label = labelNode.text;
      }
      if (!label) label = c.text ?? 'Action';
      return (
        <button
          type="button"
          className="btn-stage btn"
          onClick={() =>
            onAction(label, c.action?.event?.name, c.action?.event?.context)
          }
        >
          {label}
        </button>
      );
    }

    case 'ChoicePicker': {
      const path = bindingPath(c.value);
      const current = path ? (getAtPath(data, path) as string | undefined) : undefined;
      const opts: A2UIOption[] = Array.isArray(c.options) ? c.options : [];
      const placeholder = c.label ?? 'Choose';
      return (
        <div className="flex flex-col gap-1">
          <select
            value={current ?? ''}
            disabled={!path}
            onChange={(e) => path && onDataChange(path, e.target.value)}
            className="field field-sm w-full"
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case 'TextField': {
      const path = bindingPath(c.value);
      const current = path ? (getAtPath(data, path) as string | undefined) : undefined;
      return (
        <div className="flex flex-col gap-1">
          {c.label ? (
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">
              {c.label}
            </span>
          ) : null}
          <input
            type="text"
            value={current ?? ''}
            disabled={!path}
            onChange={(e) => path && onDataChange(path, e.target.value)}
            placeholder={c.label ?? ''}
            className="field field-sm w-full"
          />
        </div>
      );
    }

    default:
      return (
        <div data-component={c.component} className="rounded-xl border border-line/70 p-2 text-xs text-ink-subtle">
          {c.text ?? c.component}
          {(c.children ?? []).map((cid) => (
            <Node
              key={cid}
              id={cid}
              surface={surface}
              data={data}
              onAction={onAction}
              onDataChange={onDataChange}
            />
          ))}
          {c.child ? (
            <Node
              id={c.child}
              surface={surface}
              data={data}
              onAction={onAction}
              onDataChange={onDataChange}
            />
          ) : null}
        </div>
      );
  }
}

function bindingPath(
  value: A2UIComponent['value'],
): string | undefined {
  if (value && typeof value === 'object' && 'path' in value) {
    const p = (value as A2UIDataBinding).path;
    return typeof p === 'string' ? p : undefined;
  }
  return undefined;
}

// Walk a context object and replace any leaf of the form `{ path: "..." }`
// with the value read from the surface data model at that path. Anything
// that doesn't look like a binding passes through unchanged.
function resolveContext(
  ctx: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!ctx) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = resolveValue(v, data);
  }
  return out;
}

function resolveValue(v: unknown, data: Record<string, unknown>): unknown {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === 'path' && typeof obj.path === 'string') {
      return getAtPath(data, obj.path);
    }
    const nested: Record<string, unknown> = {};
    for (const [k, sub] of Object.entries(obj)) {
      nested[k] = resolveValue(sub, data);
    }
    return nested;
  }
  if (Array.isArray(v)) {
    return v.map((item) => resolveValue(item, data));
  }
  return v;
}
