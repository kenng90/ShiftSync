import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const staff = user.role === 'staff';

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <span className="mark">SS</span>
          <div>
            <strong>ShiftSync</strong>
            <small>Coastal Eats</small>
          </div>
        </div>
        <nav>
          {!staff && <NavLink to="/schedule">Schedule</NavLink>}
          <NavLink to="/availability">Availability</NavLink>
        </nav>
        <div className="who">
          <strong>
            {user.firstName} {user.lastName}
          </strong>
          <small>{user.role}</small>
          <button
            type="button"
            onClick={() => {
              logout();
              nav('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
