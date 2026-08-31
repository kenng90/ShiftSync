import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Login from './pages/Login.jsx';
import Shell from './pages/Shell.jsx';
import Schedule from './pages/Schedule.jsx';
import Availability from './pages/Availability.jsx';

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted pad">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (user?.role === 'staff') return <Navigate to="/availability" replace />;
  return <Navigate to="/schedule" replace />;
}

export default function App() {
  return (
    <AuthProvider>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
