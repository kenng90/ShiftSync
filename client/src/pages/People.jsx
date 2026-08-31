import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'staff',
  desiredWeeklyHours: 32,
  hourlyWage: 18,
  isActive: true,
  skillIds: [],
  locationIds: [],
  managedLocationIds: [],
};

export default function People() {
  const { user } = useAuth();
  const admin = user.role === 'admin';
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const [people, skillData, locs] = await Promise.all([
      api('/users'),
      api('/users/skills'),
      api('/locations'),
    ]);
    setUsers(people.users);
    setSkills(skillData.skills);
    setLocations(locs.locations);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function openCreate() {
    setError('');
    setEditingId(null);
    setForm({
      ...emptyForm,
      locationIds: admin ? [] : user.locationIds || [],
    });
  }

  function openEdit(row) {
    setError('');
    setEditingId(row.id);
    setForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      password: '',
      role: row.role,
      desiredWeeklyHours: row.desiredWeeklyHours,
      hourlyWage: row.hourlyWage || 18,
      isActive: row.isActive !== false,
      skillIds: (row.skills || []).map((s) => s.id),
      locationIds: (row.certifications || []).filter((c) => !c.revoked).map((c) => c.locationId),
      managedLocationIds: row.managedLocationIds || [],
    });
  }

  function toggle(list, id) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const body = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: admin ? form.role : 'staff',
        desiredWeeklyHours: Number(form.desiredWeeklyHours),
        hourlyWage: Number(form.hourlyWage),
        isActive: form.isActive,
      };
      if (form.password) body.password = form.password;
      let id = editingId;
      if (editingId) {
        await api(`/users/${editingId}`, { method: 'PATCH', body });
      } else {
        const created = await api('/users', { method: 'POST', body });
        id = created.id;
      }
      await api(`/users/${id}/skills`, { method: 'PUT', body: { skillIds: form.skillIds } });
      await api(`/users/${id}/certifications`, { method: 'PUT', body: { locationIds: form.locationIds } });
      if (admin && body.role === 'manager') {
        await api(`/users/${id}/locations`, {
          method: 'PUT',
          body: { locationIds: form.managedLocationIds },
        });
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="muted">
            Seeded staff stay for the evaluation scenarios. {admin ? 'Admins' : 'Managers'} can also create
            and edit {admin ? 'any account' : 'staff at their locations'}.
          </p>
        </div>
        <button type="button" className="primary" onClick={openCreate}>
          Add person
        </button>
      </header>
      {error && !form ? <p className="banner danger">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Skills</th>
            <th>Locations</th>
            <th>Desired hours</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.firstName} {u.lastName}
                <div className="muted">{u.email}</div>
              </td>
              <td>{u.role}</td>
              <td>{(u.skills || []).map((s) => s.name).join(', ') || '—'}</td>
              <td>
                {(u.certifications || [])
                  .map((c) => `${c.name}${c.revoked ? ' (revoked)' : ''}`)
                  .join(', ') || (u.managedLocationIds || []).join(', ') || '—'}
              </td>
              <td>{u.desiredWeeklyHours}</td>
              <td>
                {(admin || u.role === 'staff') && (
                  <button type="button" onClick={() => openEdit(u)}>
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {form ? (
        <div className="modal">
          <form className="card wide" onSubmit={save}>
            <h2>{editingId ? 'Edit person' : 'Add person'}</h2>
            {error ? <p className="banner danger">{error}</p> : null}
            <div className="row">
              <label>
                First name
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              </label>
              <label>
                Last name
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              </label>
            </div>
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Password {editingId ? '(leave blank to keep)' : '(default Password123!)'}
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={editingId ? 0 : 8}
              />
            </label>
            {admin ? (
              <label>
                Role
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            ) : (
              <p className="muted">Role is locked to staff for managers.</p>
            )}
            <div className="row">
              <label>
                Desired weekly hours
                <input
                  type="number"
                  min="0"
                  value={form.desiredWeeklyHours}
                  onChange={(e) => setForm({ ...form, desiredWeeklyHours: e.target.value })}
                />
              </label>
              <label>
                Hourly wage
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.hourlyWage}
                  onChange={(e) => setForm({ ...form, hourlyWage: e.target.value })}
                />
              </label>
            </div>
            <label className="row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
            <fieldset>
              <legend>Skills</legend>
              {skills.map((s) => (
                <label key={s.id} className="row">
                  <input
                    type="checkbox"
                    checked={form.skillIds.includes(s.id)}
                    onChange={() => setForm({ ...form, skillIds: toggle(form.skillIds, s.id) })}
                  />
                  {s.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Location certifications</legend>
              {locations.map((l) => (
                <label key={l.id} className="row">
                  <input
                    type="checkbox"
                    checked={form.locationIds.includes(l.id)}
                    onChange={() => setForm({ ...form, locationIds: toggle(form.locationIds, l.id) })}
                  />
                  {l.name}
                </label>
              ))}
            </fieldset>
            {admin && form.role === 'manager' ? (
              <fieldset>
                <legend>Manages locations</legend>
                {locations.map((l) => (
                  <label key={l.id} className="row">
                    <input
                      type="checkbox"
                      checked={form.managedLocationIds.includes(l.id)}
                      onChange={() =>
                        setForm({ ...form, managedLocationIds: toggle(form.managedLocationIds, l.id) })
                      }
                    />
                    {l.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="row">
              <button type="submit" className="primary">
                Save
              </button>
              <button type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
