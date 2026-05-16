import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import Referral from '@/screens/Referral';
import SurgicalTeam from '@/screens/SurgicalTeam';
import AlliedHealth from '@/screens/AlliedHealth';
import Graph from '@/screens/Graph';
import Audit from '@/screens/Audit';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/referral" replace />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/surgical-team" element={<SurgicalTeam />} />
        <Route path="/allied-health" element={<AlliedHealth />} />
        <Route path="/graph" element={<Graph />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/referral" replace />} />
      </Route>
    </Routes>
  );
}
