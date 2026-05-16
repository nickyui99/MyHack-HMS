import { useLocation } from 'react-router-dom';
import { stageForPath } from '@/lib/stages';
import { quickActionsFor } from '@/lib/chat/quickActions';
import { useChat } from '@/lib/chat/ChatContext';

export default function QuickActions() {
  const { pathname } = useLocation();
  const { send, isStreaming, messages } = useChat();
  const stageKey = pathname.startsWith('/audit') ? 'audit' : stageForPath(pathname).key;
  const prompts = quickActionsFor(stageKey);

  // Hide once the conversation has started — they clutter the composer area.
  if (messages.length > 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 border-t border-line/70 px-4 py-3">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          disabled={isStreaming}
          onClick={() => send(p)}
          className="chip chip-stage hover:brightness-95 disabled:opacity-50"
          style={{ cursor: isStreaming ? 'not-allowed' : 'pointer' }}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
