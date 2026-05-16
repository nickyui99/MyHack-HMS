import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useChat } from '@/lib/chat/ChatContext';

export default function ChatComposer() {
  const { send, isStreaming, enabled } = useChat();
  const [text, setText] = useState('');

  const submit = (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    if (!text.trim() || isStreaming) return;
    const t = text;
    setText('');
    void send(t);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      submit(e);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-line/70 bg-paper/95 px-3 py-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={enabled ? 'Ask about this patient…' : 'Chat backend not configured'}
          disabled={!enabled || isStreaming}
          rows={2}
          className="field min-h-[44px] flex-1 resize-none rounded-2xl py-2 text-[13px] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!enabled || isStreaming || !text.trim()}
          className="btn-stage btn disabled:opacity-50"
        >
          {isStreaming ? '…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
