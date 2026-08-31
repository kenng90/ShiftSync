import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Fairness() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(null);
  const [data, setData] = useState(null);
  const [premiumOnly, setPremiumOnly] = useState(false);

  useEffect(() => {
    api('/locations').then((d) => {
      setLocations(d.locations);
      setLocationId(d.locations[0]?.id);
    });
  }, []);

  useEffect(() => {
    if (!locationId) return;
    api(`/fairness?locationId=${locationId}&from=2026-08-24&to=2026-09-07`).then(setData);
  }, [locationId]);

  const rows = (data?.distribution || []).filter((s) => !premiumOnly || s.premiumShifts > 0);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Schedule fairness</h1>
          <p className="muted">Use this to check a Saturday-night complaint: sort premium counts, not vibes.</p>
        </div>
        <select value={locationId || ''} onChange={(e) => setLocationId(Number(e.target.value))}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </header>
      <p className="stat">
        Premium equity score: <strong>{data?.fairness?.score ?? '—'}</strong>
        <span className="muted"> {data?.fairness?.note}</span>
      </p>
      <p className="muted">{data?.premiumDefinition}</p>
      <label className="row">
        <input type="checkbox" checked={premiumOnly} onChange={(e) => setPremiumOnly(e.target.checked)} />
        Only staff who received premium (Fri/Sat evening) shifts
      </label>
      <table>
        <thead>
          <tr>
            <th>Staff</th>
            <th>Hours</th>
            <th>Desired</th>
            <th>Delta</th>
            <th>Premium (Fri/Sat eve)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.userId} className={s.status === 'under' ? 'warm' : s.premiumShifts > 2 ? 'hot' : ''}>
              <td>{s.name}</td>
              <td>{s.hours.toFixed(1)}</td>
              <td>{s.targetHours.toFixed(1)}</td>
              <td>{s.delta.toFixed(1)}</td>
              <td>{s.premiumShifts}</td>
              <td>{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
