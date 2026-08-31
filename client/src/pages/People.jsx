import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function People() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api('/users')
      .then((d) => setUsers(d.users))
      .catch(() => {});
  }, []);

  return (
    <div>
      <header className="page-head">
        <h1>People</h1>
        <p className="muted">Skills, certifications, and desired hours. Revoked certs stay on the record.</p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Skills</th>
            <th>Locations</th>
            <th>Desired hours</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.firstName} {u.lastName}
              </td>
              <td>{u.role}</td>
              <td>{(u.skills || []).map((s) => s.name).join(', ') || '—'}</td>
              <td>
                {(u.certifications || [])
                  .map((c) => `${c.name}${c.revoked ? ' (revoked)' : ''}`)
                  .join(', ') || (u.managedLocationIds || []).join(', ') || '—'}
              </td>
              <td>{u.desiredWeeklyHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
