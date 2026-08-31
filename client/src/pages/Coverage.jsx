import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ConstraintBanner from '../components/ConstraintBanner.jsx';

export default function Coverage() {
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState(null);
  const [note, setNote] = useState('');

  async function load() {
    const data = await api('/shifts/open/eligible');
    setShifts(data.shifts);
  }

  useEffect(() => {
    load().catch((e) => setError(e));
  }, []);

  async function pickup(id) {
    setError(null);
    try {
      await api('/swaps', { method: 'POST', body: { type: 'pickup', shiftId: id } });
      setNote('Pickup requested. You are not on the shift until a manager approves.');
      await load();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>Coverage board</h1>
        <p className="muted">Open published shifts you are qualified to take. Fastest path for a Sunday call-out.</p>
      </header>
      <ConstraintBanner error={error} />
      {note ? <p className="banner">{note}</p> : null}
      <div className="stack">
        {shifts.map((s) => (
          <article key={s.id} className="card shift-row">
            <div>
              <strong>{s.locationName}</strong>
              <p>
                {s.localLabel} · {s.skillName} · {s.openSlots} open
              </p>
            </div>
            <button type="button" className="primary" onClick={() => pickup(s.id)}>
              Request pickup
            </button>
          </article>
        ))}
        {!shifts.length ? <p className="muted">No open shifts you can pick up right now.</p> : null}
      </div>
    </div>
  );
}
