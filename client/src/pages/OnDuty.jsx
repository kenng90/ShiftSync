import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLive } from '../SocketContext.jsx';

export default function OnDuty() {
  const live = useLive();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api('/on-duty')
      .then((d) => setRows(d.onDuty))
      .catch(() => {});
  }, [live?.tick]);

  const byLocation = new Map();
  for (const row of rows) {
    const name = row.shift.locationName;
    if (!byLocation.has(name)) byLocation.set(name, []);
    byLocation.get(name).push(row);
  }

  return (
    <div>
      <header className="page-head">
        <h1>On duty now</h1>
        <p className="muted">Live. Updates when someone clocks in or out — no refresh needed.</p>
      </header>
      {[...byLocation.entries()].map(([name, people]) => (
        <section key={name} className="card">
          <h2>{name}</h2>
          <ul>
            {people.map((p) => (
              <li key={p.assignmentId}>
                {p.name} · {p.skillName} · {p.shift.localLabel}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!rows.length ? <p className="muted">Nobody is clocked in right now.</p> : null}
    </div>
  );
}
