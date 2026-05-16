interface Props {
  filters: { label: string; options: string[]; value: string; onChange: (v: string) => void }[];
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  trailing?: React.ReactNode;
}

export default function FilterBar({ filters, search, trailing }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-3xl border border-line/80 bg-paper p-2.5 shadow-soft">
      {search && (
        <div className="relative min-w-[220px] flex-1">
          <svg
            viewBox="0 0 24 24"
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-3.5-3.5" />
          </svg>
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search'}
            className="field w-full pl-10"
          />
        </div>
      )}

      {filters.map((f) => (
        <label key={f.label} className="flex items-center gap-2 pl-2 text-[10px] uppercase tracking-[0.18em] text-ink-subtle">
          <span>{f.label}</span>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="field field-sm normal-case tracking-normal"
          >
            {f.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      ))}

      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
