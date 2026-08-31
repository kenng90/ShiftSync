import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useLive } from '../SocketContext.jsx';
import ConstraintBanner from '../components/ConstraintBanner.jsx';

export default function Swaps() {
  const { user } = useAuth();
  const live = useLive();
  const [requests, setRequests] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    const data = await api('/swaps');
    setRequests(data.requests);
    if (user.role === 'staff') {
      const shifts = await api('/shifts/me/mine');
      setMine(shifts.shifts);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e));
  }, [user.role, live?.tick]);

  async function act(id, action) {
    setError(null);
    try {
      await api(`/swaps/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  async function drop(shiftId) {
    try {
      await api('/swaps', { method: 'POST', body: { type: 'drop', shiftId } });
      await load();
    } catch (e) {
      setError(e);
    }
  }

  const manager = user.role !== 'staff';
  return (
    <div>
      <header className="page-head">
        <h1>{manager ? 'Swap & drop approvals' : 'Swap and drop'}</h1>
        <p className="muted">Original assignment stays until a manager approves. Cap is 3 pending requests.</p>
      </header>
      <ConstraintBanner error={error} />
      {user.role === 'staff' ? (
        <section className="card">
          <h2>Offer a shift up</h2>
          {mine.map((s) => (
            <div key={s.id} className="shift-row">
              <span>{s.localLabel}</span>
              <button type="button" onClick={() => drop(s.id)}>
                Drop request
              </button>
            </div>
          ))}
        </section>
      ) : null}
      <div className="stack">
        {requests.map((r) => (
          <article key={r.id} className="card">
            <p>
              <strong>{r.type}</strong> · {r.status} · {r.location_name}
            </p>
            <p className="muted">{r.reason}</p>
            <div className="row">
              {r.status === 'pending_counterparty' && r.to_user_id === user.id ? (
                <button type="button" className="primary" onClick={() => act(r.id, 'accept')}>
                  Accept swap
                </button>
              ) : null}
              {['pending_counterparty', 'pending_manager'].includes(r.status) &&
              (r.from_user_id === user.id || r.to_user_id === user.id) ? (
                <button type="button" onClick={() => act(r.id, 'cancel')}>
                  Cancel (change of mind)
                </button>
              ) : null}
              {manager && r.status === 'pending_manager' ? (
                <>
                  <button type="button" className="primary" onClick={() => act(r.id, 'approve')}>
                    Approve
                  </button>
                  <button type="button" onClick={() => act(r.id, 'deny')}>
                    Deny
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
