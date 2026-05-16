import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { cases as defaultCases } from '@/data/cases';
import type { PatientCase } from '@/lib/types';

interface ActiveCaseCtx {
  cases: PatientCase[];
  active: PatientCase;
  setActiveId: (id: string) => void;
}

const Ctx = createContext<ActiveCaseCtx | null>(null);

/**
 * Wrap the app once. Picks the first seeded case as the initial active
 * patient; the TopBar dropdown drives `setActiveId`, which causes every
 * screen reading `useActiveCase()` to re-fetch matches for the new case.
 */
export function ActiveCaseProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string>(defaultCases[0].id);
  const value = useMemo<ActiveCaseCtx>(() => {
    const active = defaultCases.find((c) => c.id === activeId) ?? defaultCases[0];
    return { cases: defaultCases, active, setActiveId };
  }, [activeId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveCase(): ActiveCaseCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useActiveCase must be used inside <ActiveCaseProvider>');
  return v;
}
