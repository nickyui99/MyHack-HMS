interface Props {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export default function TextMessage({ role, text }: Props) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug text-white shadow-soft"
          style={{ background: 'var(--stage-deep)' }}
        >
          {text}
        </div>
      </div>
    );
  }

  if (role === 'system') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-900">
        {text}
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl border border-line bg-paper px-3.5 py-2 text-[13px] leading-snug text-ink shadow-soft">
        {text || <span className="text-ink-subtle">…</span>}
      </div>
    </div>
  );
}
