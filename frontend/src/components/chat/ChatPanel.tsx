import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { stageForPath } from '@/lib/stages';
import { useActiveCase } from '@/lib/activeCase';
import { useChat } from '@/lib/chat/ChatContext';
import ChatHistory from './ChatHistory';
import ChatComposer from './ChatComposer';
import QuickActions from './QuickActions';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChatPanel({ open, onClose }: Props) {
  const { pathname } = useLocation();
  const stage = stageForPath(pathname);
  const { active } = useActiveCase();
  const { clear, error } = useChat();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-hidden={!open}
      className={[
        'fixed right-4 top-20 z-40 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-pop transition-all duration-200',
        open
          ? 'pointer-events-auto translate-x-0 opacity-100'
          : 'pointer-events-none translate-x-6 opacity-0',
      ].join(' ')}
      style={{ height: 'min(640px, calc(100vh - 6rem))' }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-line/70 bg-paper/95 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-lg text-[11px] font-semibold text-white"
            style={{ background: 'var(--stage-deep)' }}
          >
            {stage.number === '—' ? '∞' : stage.number}
          </span>
          <div className="min-w-0">
            <div className="display truncate text-[13px] font-semibold text-ink">
              Assistant · {stage.title}
            </div>
            <div className="truncate text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
              {active.patientName} · {active.diagnosis}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clear}
            className="btn-ghost btn px-2 py-1 text-[11px]"
            title="Clear conversation"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost btn px-2 py-1 text-[13px]"
            title="Close (Esc)"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <ChatHistory />
      </div>

      {error ? (
        <div className="border-t border-rose-200 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-800">
          {error}
        </div>
      ) : null}

      <QuickActions />
      <ChatComposer />
    </aside>
  );
}
