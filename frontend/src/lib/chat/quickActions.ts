import type { StageKey } from '@/lib/stages';

/**
 * Per-stage one-tap prompts. Each renders as a chip in the chat panel;
 * tapping inserts the text as a user message (no extra editing required).
 *
 * Prompts are written against the agent surface in `adk/agents/carelink/agent.py`:
 *   - referral       (find_cardiologist_candidates / confirm_referral)
 *   - team_assembly  (find_surgical_team / lock_team)
 *   - allied_health  (find_allied_specialists / book_specialist)
 *   - outcome        (open_outcome_form / record_case_outcome)
 *   - compliance     (auto-invoked, no direct prompts)
 *
 * The active persona (Dr Amirul) must include each of those agents in
 * `adk/personas/personas.json#allowed_agents`, otherwise the orchestrator
 * refuses with "out of scope".
 */
export const QUICK_ACTIONS: Record<StageKey | 'audit', string[]> = {
  referral: [
    'Show cardiologist candidates for this patient',
    'Why is the top match ranked first?',
    'Confirm the top referral',
  ],
  surgical: [
    'Assemble the surgical team for this case',
    'Lock the suggested CABG team',
  ],
  allied: [
    'Find allied health specialists',
    'Book a physiotherapist for this patient',
  ],
  // No graph specialist exists in ADK. Outcome operations update relationship
  // weights, which is what re-draws this view — route there instead.
  graph: [
    'Open the outcome form for this case',
    'Record an outcome to refresh graph weights',
  ],
  // No audit specialist exists either. Outcome records are the auditable
  // events; surfacing the form is the closest agent-driven entry point.
  audit: [
    'Open the outcome form',
    'Record the surgical outcome',
  ],
};

export function quickActionsFor(stageKey: StageKey | 'audit' | string): string[] {
  return QUICK_ACTIONS[stageKey as keyof typeof QUICK_ACTIONS] ?? QUICK_ACTIONS.referral;
}
