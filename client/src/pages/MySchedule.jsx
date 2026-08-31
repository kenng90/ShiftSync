import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { api } from '../api.js';
import { mondayOf } from '../dates.js';
import ConstraintBanner from '../components/ConstraintBanner.jsx';

export default function MySchedule() {
  const [shifts, setShifts] = useState([]);
  const [error, setError] = useState(null);
  const [swapFor, setSwapFor] = useState(null);
  const [people, setPeople] = useState([]);
  const weekStart = mondayOf(DateTime.fromISO('2026-08-31')).toISODate();
  const from = DateTime.fromISO(weekStart).minus({ days: 1 }).toUTC().toISO();
  const to = DateTime.fromISO(weekStart).plus({ days: 8 }).toUTC().toISO();

  async function load() {
    const data = await api(`/shifts/me/mine?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    setShifts(data.shifts);
  }

  useEffect(() => {
    load().catch((e) => setError(e));
  }, [from, to]);

  async function clock(id, dir) {
    await api(`/shifts/assignments/${id}/clock-${dir}`, { method: 'POST' });
    await load();
  }

  async function openSwap(shift) {
    setError(null);
    setSwapFor(shift);
    const data = await api(`/shifts/${shift.id}/eligible`);
    setPeople(data.people.filter((p) => p.userId !== shift.assignments?.[0]?.userId));
  }

  async function requestSwap(userId) {
    try {
      await api('/swaps', {
        method: 'POST',
        body: { type: 'swap', shiftId: swapFor.id, toUserId: userId, reason: 'Can we trade this shift?' },
      });
      setSwapFor(null);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>My published shifts</h1>
        <p className="muted">Times are shown in each restaurant’s timezone, not yours.</p>
      </header>
      <ConstraintBanner error={error} />
      <div className="stack">
        {shifts.map((s) => (
          <article key={s.id} className="card shift-row">
            <div>
              <strong>{s.locationName}</strong>
              <p>
                {s.localLabel} · {s.skillName}
              </p>
            </div>
            <div className="row">
              <button type="button" onClick={() => openSwap(s)}>
                Request swap
              </button>
              {s.assignmentStatus !== 'clocked_in' ? (
                <button type="button" className="primary" onClick={() => clock(s.assignmentId, 'in')}>
                  Clock in
                </button>
              ) : (
                <button type="button" onClick={() => clock(s.assignmentId, 'out')}>
                  Clock out
                </button>
              )}
            </div>
          </article>
        ))}
        {!shifts.length ? <p className="muted">No published shifts this week.</p> : null}
      </div>
      {swapFor ? (
        <div className="modal">
          <div className="card">
            <h2>Swap {swapFor.localLabel}</h2>
            <ul className="people">
              {people.map((p) => (
                <li key={p.userId}>
                  <button type="button" className="primary" onClick={() => requestSwap(p.userId)}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setSwapFor(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
