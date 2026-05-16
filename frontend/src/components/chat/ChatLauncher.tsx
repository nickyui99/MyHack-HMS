import { useChat } from '@/lib/chat/ChatContext';
import ChatPanel from './ChatPanel';

export default function ChatLauncher() {
  const { enabled, open, toggle, closePanel, isStreaming } = useChat();

  return (
    <>
      <ChatPanel open={open} onClose={closePanel} />
      <button
        type="button"
        onClick={toggle}
        title={enabled ? 'CareLink Assistant' : 'Chat backend not configured'}
        aria-label="Toggle CareLink Assistant"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full text-white shadow-pop transition-transform hover:scale-105 active:scale-95"
        style={{
          background: 'var(--stage-deep)',
          opacity: enabled ? 1 : 0.6,
        }}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
        {isStreaming ? (
          <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-coral-400 ring-2 ring-paper" />
        ) : null}
      </button>
    </>
  );
}
