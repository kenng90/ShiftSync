import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { DEMO } from '../demoAccounts.js';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(DEMO[1].email);
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      nav(user.role === 'staff' ? '/availability' : '/schedule');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-hero">
        <p className="eyebrow">Coastal Eats</p>
        <h1>ShiftSync</h1>
        <p>Four kitchens. Two coasts. One schedule that does not lie about overtime, rest, or who got Saturday night.</p>
      </section>
      <form className="card login-card" onSubmit={onSubmit}>
        <h2>Sign in</h2>
        {error ? <p className="banner danger">{error}</p> : null}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="primary">
          Enter the floor
        </button>
        <p className="muted">Demo password for every account: <code>Password123!</code></p>
        <div className="demo-list">
          {DEMO.map((d) => (
            <button key={d.email} type="button" className="demo" onClick={() => setEmail(d.email)}>
              <strong>{d.role}</strong>
              <span>{d.note}</span>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
