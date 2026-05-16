import { useEffect, useRef } from 'react';
import { useChat } from '@/lib/chat/ChatContext';
import TextMessage from './TextMessage';
import A2UISurface from './A2UISurface';

export default function ChatHistory() {
  const { messages, isStreaming } = useChat();
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft"
          style={{ background: 'var(--stage-deep)' }}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
        <p className="display text-[15px] font-semibold text-ink">CareLink Assistant</p>
        <p className="text-[12px] text-ink-subtle">
          Ask about this patient, the current stage, or how the match was scored.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {messages.map((m) => {
        if (m.kind === 'surface') {
          return <A2UISurface key={m.id} surfaceId={m.surfaceId} />;
        }
        return <TextMessage key={m.id} role={m.role} text={m.text} />;
      })}
      {isStreaming ? (
        <div className="px-2 text-[11px] uppercase tracking-[0.16em] text-ink-subtle">
          Assistant is typing…
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
