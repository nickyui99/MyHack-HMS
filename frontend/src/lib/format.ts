export const pct = (n: number, digits = 0) =>
  `${(n * 100).toFixed(digits)}%`;

export const score100 = (n: number) => Math.round(n * 100);

export const initials = (name: string) =>
  (name ?? '')
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

/**
 * Format a nullable value, returning the literal word "NULL" when the
 * backend doesn't provide it. Use whenever a domain field is `| null`.
 */
export const nullable = <T>(v: T | null | undefined, fmt: (x: T) => string = String): string =>
  v === null || v === undefined ? 'NULL' : fmt(v);

export const dateShort = (iso: string | null | undefined) => {
  if (!iso) return 'NULL';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'NULL';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const isApcExpiring = (iso: string | null | undefined, days = 90) => {
  if (!iso) return false;
  const now = Date.now();
  const expiry = new Date(iso).getTime();
  if (Number.isNaN(expiry)) return false;
  const diff = expiry - now;
  return diff > 0 && diff < days * 24 * 60 * 60 * 1000;
};
