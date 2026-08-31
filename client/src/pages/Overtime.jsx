import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { api } from '../api.js';
import { mondayOf } from '../dates.js';

export default function Overtime() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(null);
  const [data, setData] = useState(null);
  const weekStart = mondayOf(DateTime.fromISO('2026-08-31')).toISODate();

  useEffect(() => {
    api('/locations').then((d) => {
      setLocations(d.locations);
      setLocationId(d.locations[0]?.id);
    });
  }, []);

  useEffect(() => {
    if (!locationId) return;
    api(`/labor/overtime?locationId=${locationId}&weekStart=${weekStart}`).then(setData);
  }, [locationId, weekStart]);

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Overtime projection</h1>
          <p className="muted">Week of {weekStart}. Warns at 35 hours; cost is 1.5× wage on hours over 40.</p>
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
        Projected OT cost this week: <strong>${data?.projectedCost?.toFixed?.(2) || '0.00'}</strong>
      </p>
      <table>
        <thead>
          <tr>
            <th>Staff</th>
            <th>Hours</th>
            <th>OT hours</th>
            <th>Cost</th>
            <th>Flags</th>
            <th>Assignments pushing OT</th>
          </tr>
        </thead>
        <tbody>
          {(data?.staff || []).map((s) => (
            <tr key={s.userId} className={s.otHours > 0 ? 'hot' : s.warn35 ? 'warm' : ''}>
              <td>{s.name}</td>
              <td>{s.hours.toFixed(1)}</td>
              <td>{s.otHours.toFixed(1)}</td>
              <td>${s.otCost.toFixed(2)}</td>
              <td>
                {s.warn35 ? '35+ warning' : ''}
                {s.otHours > 0 ? ' overtime' : ''}
              </td>
              <td>
                {(s.pushingAssignments || [])
                  .map((a) => `#${a.shiftId} (${a.hours.toFixed(1)}h)`)
                  .join(', ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!(data?.staff || []).length ? <p className="muted">No assignments this week at this location.</p> : null}
    </div>
  );
}
