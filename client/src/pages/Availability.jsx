import { useEffect, useState } from 'react';
import { api } from '../api.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Availability() {
  const [windows, setWindows] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [draft, setDraft] = useState({
    dayOfWeek: 1,
    startLocal: '09:00',
    endLocal: '17:00',
  });
  const [ex, setEx] = useState({ onDate: '2026-09-06', kind: 'unavailable', note: '' });
  const [message, setMessage] = useState('');

  async function load() {
    const data = await api('/availability/me');
    setWindows(data.windows);
    setExceptions(data.exceptions);
  }

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);

  async function saveWindows(next) {
    await api('/availability/me/windows', {
      method: 'PUT',
      body: {
        windows: next.map((w) => ({
          dayOfWeek: Number(w.day_of_week ?? w.dayOfWeek),
          startLocal: String(w.start_local ?? w.startLocal).slice(0, 5),
          endLocal: String(w.end_local ?? w.endLocal).slice(0, 5),
          overnight: Boolean(w.overnight),
        })),
      },
    });
    await load();
    setMessage('Recurring availability saved. Wall-clock times are interpreted in each location’s timezone.');
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Availability</h1>
          <p className="muted">
            “9am–5pm” means 9–5 at the restaurant you are scheduled at: Pacific at Cannon Beach, Eastern
            at Charleston: including DST.
          </p>
        </div>
      </header>
      {message ? <p className="banner">{message}</p> : null}
      <section className="card">
        <h2>Weekly windows</h2>
        <ul className="stack">
          {windows.map((w) => (
            <li key={w.id} className="shift-row">
              <span>
                {DAYS[w.day_of_week]} {String(w.start_local).slice(0, 5)}–{String(w.end_local).slice(0, 5)}
                {w.overnight ? ' (overnight)' : ''}
              </span>
              <button
                type="button"
                onClick={() => saveWindows(windows.filter((x) => x.id !== w.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            saveWindows([
              ...windows,
              {
                dayOfWeek: Number(draft.dayOfWeek),
                startLocal: draft.startLocal,
                endLocal: draft.endLocal,
                overnight: draft.endLocal <= draft.startLocal,
              },
            ]);
          }}
        >
          <select value={draft.dayOfWeek} onChange={(e) => setDraft({ ...draft, dayOfWeek: e.target.value })}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input value={draft.startLocal} onChange={(e) => setDraft({ ...draft, startLocal: e.target.value })} />
          <input value={draft.endLocal} onChange={(e) => setDraft({ ...draft, endLocal: e.target.value })} />
          <button type="submit" className="primary">
            Add window
          </button>
        </form>
      </section>
      <section className="card">
        <h2>One-off exceptions</h2>
        <ul className="stack">
          {exceptions.map((item) => (
            <li key={item.id} className="shift-row">
              <span>
                {String(item.on_date).slice(0, 10)} · {item.kind}
                {item.note ? ` · ${item.note}` : ''}
              </span>
              <button type="button" onClick={() => api(`/availability/me/exceptions/${item.id}`, { method: 'DELETE' }).then(load)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            await api('/availability/me/exceptions', { method: 'POST', body: ex });
            setEx({ ...ex, note: '' });
            await load();
          }}
        >
          <input value={ex.onDate} onChange={(e) => setEx({ ...ex, onDate: e.target.value })} />
          <select value={ex.kind} onChange={(e) => setEx({ ...ex, kind: e.target.value })}>
            <option value="unavailable">Unavailable</option>
            <option value="extra">Extra available</option>
          </select>
          <input
            placeholder="Note"
            value={ex.note}
            onChange={(e) => setEx({ ...ex, note: e.target.value })}
          />
          <button type="submit">Add exception</button>
        </form>
      </section>
    </div>
  );
}
