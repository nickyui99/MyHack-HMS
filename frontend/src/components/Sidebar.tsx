import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { stageList } from '@/lib/stages';
import StageIcon from './StageIcon';
import NewActorModal from './NewActorModal';

export default function Sidebar() {
  const [newActorOpen, setNewActorOpen] = useState(false);
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line/70 bg-paper md:flex">
      <div className="flex h-16 items-center gap-3 border-b border-line/70 px-5">
        <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-teal">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M7 12c0-3 3-5 5-5s5 2 5 5-3 5-5 5" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          </svg>
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-coral-400 ring-2 ring-paper" />
        </div>
        <div className="leading-tight">
          <div className="display text-lg font-semibold tracking-tightish text-ink">
            CareLink
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-subtle">
            Hospital Ecosystem
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <div className="section-label px-3 pb-3">Patient Journey</div>
        <ul className="space-y-1.5">
          {stageList.map((s) => (
            <li key={s.key}>
              <NavLink
                to={s.path}
                className={({ isActive }) =>
                  [
                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200',
                    isActive
                      ? 'shadow-soft text-white'
                      : 'text-ink-muted hover:bg-cream/70 hover:text-ink',
                  ].join(' ')
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: `linear-gradient(135deg, ${s.colors.deep}, ${s.colors.ink})` }
                    : undefined
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'grid h-8 w-8 place-items-center rounded-xl text-[11px] font-semibold tabular transition',
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-cream group-hover:bg-paper',
                      ].join(' ')}
                      style={!isActive ? { color: s.colors.deep } : undefined}
                    >
                      {s.number}
                    </span>
                    <span className="flex-1 leading-tight">
                      <span className="block font-medium">{s.title}</span>
                      <span
                        className={[
                          'block text-[10px] tracking-wide',
                          isActive ? 'text-white/75' : 'text-ink-subtle',
                        ].join(' ')}
                      >
                        {s.family === 'Network' ? 'Network view' : s.question}
                      </span>
                    </span>
                    <StageIcon
                      name={s.icon}
                      className={`h-4 w-4 ${isActive ? 'text-white/85' : 'text-ink-subtle group-hover:text-ink'}`}
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="section-label mt-7 px-3 pb-3">Operations</div>
        <ul className="space-y-1 text-sm">
          <li>
            <NavLink
              to="/audit"
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-2xl px-3 py-2 transition',
                  isActive
                    ? 'bg-ink text-canvas'
                    : 'text-ink-muted hover:bg-cream/70 hover:text-ink',
                ].join(' ')
              }
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Audit Log
              <span className="chip ml-auto">GET /audit</span>
            </NavLink>
          </li>
          <li>
            <button
              onClick={() => setNewActorOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-ink-muted transition hover:bg-cream/70 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New clinician
              <span className="chip ml-auto">POST /actors</span>
            </button>
          </li>
        </ul>
      </nav>
      <NewActorModal open={newActorOpen} onClose={() => setNewActorOpen(false)} />
    </aside>
  );
}
