import { useEffect, useState } from 'react';
import { api, getToken } from '../api.js';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [from, setFrom] = useState('2026-08-24');
  const [to, setTo] = useState('2026-09-08');

  async function load() {
    const data = await api(`/audit?from=${from}&to=${to}`);
    setLogs(data.logs);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return (
    <div>
      <header className="page-head">
        <h1>Audit log</h1>
        <div className="row">
          <input value={from} onChange={(e) => setFrom(e.target.value)} />
          <input value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="primary" onClick={load}>
            Filter
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/audit/export?from=${from}&to=${to}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'shiftsync-audit.csv';
              a.click();
            }}
          >
            Export CSV
          </button>
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Location</th>
            <th>Entity</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{String(l.created_at)}</td>
              <td>{l.email || 'system'}</td>
              <td>{l.location_name || '—'}</td>
              <td>
                {l.entity_type} #{l.entity_id}
              </td>
              <td>{l.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
