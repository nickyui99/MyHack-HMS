import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { stageForPath } from '@/lib/stages';
import { useEffect } from 'react';

export default function AppShell() {
  const { pathname } = useLocation();
  const stage = stageForPath(pathname);

  // Drive --stage-* CSS variables off the route, so the page tint, chips,
  // and "stage" buttons all shift together.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--stage-soft', stage.colors.soft);
    root.style.setProperty('--stage-mid',  stage.colors.mid);
    root.style.setProperty('--stage-deep', stage.colors.deep);
    root.style.setProperty('--stage-ink',  stage.colors.ink);
  }, [stage]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="scroll-thin stage-canvas min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1180px] px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
