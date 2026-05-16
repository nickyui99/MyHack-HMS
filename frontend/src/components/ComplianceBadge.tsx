import type { ComplianceFlags } from '@/lib/types';

interface Props {
  c: ComplianceFlags;
}

export default function ComplianceBadge({ c }: Props) {
  const items = [
    { label: 'APC', ok: c.apcValid },
    { label: 'Panel', ok: c.panelMatch },
    { label: 'Capacity', ok: c.capacityOk },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i.label}
          className={`chip ${i.ok ? 'chip-ok' : 'chip-danger'}`}
          title={`${i.label}: ${i.ok ? 'pass' : 'fail'}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${i.ok ? 'bg-emerald-500' : 'bg-rose-500'}`}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
