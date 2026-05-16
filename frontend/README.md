# CareLink — Frontend (Member 1)

Frontend-only design scaffold for the CareLink hackathon project. All data is
mocked; no backend calls. Wire to the FastAPI backend later via a thin
`src/lib/api.ts` module.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build into dist/
npm run typecheck    # tsc only
```

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS 3 (design tokens in `tailwind.config.js`)
- React Router 6 (routes in `src/App.tsx`)

## Where to edit

| Want to change… | File |
|---|---|
| Colors / typography | `tailwind.config.js`, `src/index.css` |
| Sidebar nav | `src/components/Sidebar.tsx` |
| Top bar | `src/components/TopBar.tsx` |
| Layout / Copilot toggle | `src/components/AppShell.tsx` |
| Copilot chat | `src/components/CopilotPanel.tsx` |
| A candidate card | `src/components/CandidateCard.tsx` |
| Score breakdown bars | `src/components/ScoreBreakdown.tsx` |
| Compliance chips | `src/components/ComplianceBadge.tsx` |
| Referral screen | `src/screens/Referral.tsx` |
| Surgical team screen | `src/screens/SurgicalTeam.tsx` |
| Allied health screen | `src/screens/AlliedHealth.tsx` |
| Graph view | `src/screens/Graph.tsx` |
| Mock actors | `src/data/actors.ts` |
| Mock candidates | `src/data/matches.ts` |
| Mock relationships | `src/data/relationships.ts` |
| Patient cases | `src/data/cases.ts` |
| Initial Copilot messages | `src/data/copilot.ts` |

## Routes

- `/referral` — Stage 1 GP referral matching
- `/surgical-team` — Stage 2 CABG team assembly
- `/allied-health` — Stage 3 post-op coordination
- `/graph` — Relationship graph for the active patient

## Notes for later integration

- Backend base URL should land in a single `src/lib/api.ts` (not added yet
  — frontend-only design).
- Identity Platform / IAP login should wrap `<App />` in `main.tsx`.
- Replace mock arrays in `src/data/` with API responses; types in
  `src/lib/types.ts` are the contract.
