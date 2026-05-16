import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cases as fallbackCases } from '@/data/cases';
import { loadCases } from '@/data/source';
import type { PatientCase } from '@/lib/types';

interface ActiveCaseCtx {
  cases: PatientCase[];
  active: PatientCase;
  setActiveId: (id: string) => void;
  addCase: (c: PatientCase) => void;
}

const Ctx = createContext<ActiveCaseCtx | null>(null);

/**
 * Wrap the app once. Seeds with the local mock list so the first paint always
 * has a valid active patient, then fetches the real list from the backend and
 * swaps it in. If the previously selected patient still exists in the fetched
 * list it's preserved; otherwise we fall back to the first fetched case.
 */
export function ActiveCaseProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<PatientCase[]>(fallbackCases);
  const [activeId, setActiveId] = useState<string>(fallbackCases[0].id);

  useEffect(() => {
    let cancelled = false;
    loadCases().then(({ data }) => {
      if (cancelled || data.length === 0) return;
      setCases(data);
      setActiveId((current) =>
        data.some((c) => c.id === current) ? current : data[0].id,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addCase = useCallback((c: PatientCase) => {
    setCases((prev) => (prev.some((p) => p.id === c.id) ? prev : [c, ...prev]));
    setActiveId(c.id);
  }, []);

  const value = useMemo<ActiveCaseCtx>(() => {
    const active = cases.find((c) => c.id === activeId) ?? cases[0];
    return { cases, active, setActiveId, addCase };
  }, [cases, activeId, addCase]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveCase(): ActiveCaseCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useActiveCase must be used inside <ActiveCaseProvider>');
  return v;
}
