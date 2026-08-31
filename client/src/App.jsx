import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { SocketProvider } from './SocketContext.jsx';
import Login from './pages/Login.jsx';
import Shell from './pages/Shell.jsx';
import Schedule from './pages/Schedule.jsx';
import Availability from './pages/Availability.jsx';
import MySchedule from './pages/MySchedule.jsx';
import Coverage from './pages/Coverage.jsx';
import Swaps from './pages/Swaps.jsx';
import Overtime from './pages/Overtime.jsx';
import Fairness from './pages/Fairness.jsx';
import Inbox from './pages/Inbox.jsx';
import OnDuty from './pages/OnDuty.jsx';
import Audit from './pages/Audit.jsx';

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted pad">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (user?.role === 'staff') return <Navigate to="/mine" replace />;
  return <Navigate to="/schedule" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <Guard>
                <Shell />
              </Guard>
            }
          >
            <Route index element={<Home />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="availability" element={<Availability />} />
            <Route path="mine" element={<MySchedule />} />
            <Route path="coverage" element={<Coverage />} />
            <Route path="swaps" element={<Swaps />} />
            <Route path="overtime" element={<Overtime />} />
            <Route path="fairness" element={<Fairness />} />
            <Route path="on-duty" element={<OnDuty />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="audit" element={<Audit />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
