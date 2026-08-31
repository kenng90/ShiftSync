import { useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { mondayOf, weekDays } from '../dates.js';
import ConstraintBanner from '../components/ConstraintBanner.jsx';
import { useLive } from '../SocketContext.jsx';

export default function Schedule() {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(user.locationIds?.[0]);
  const [weekStart, setWeekStart] = useState(mondayOf(DateTime.fromISO('2026-08-31')).toISODate());
  const [shifts, setShifts] = useState([]);
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState(null);
  const [assign, setAssign] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState(null);
  const live = useLive();

  const from = DateTime.fromISO(weekStart).minus({ days: 1 }).toUTC().toISO();
  const to = DateTime.fromISO(weekStart).plus({ days: 8 }).toUTC().toISO();

  useEffect(() => {
    api('/locations').then((d) => {
      setLocations(d.locations);
      if (!locationId && d.locations[0]) setLocationId(d.locations[0].id);
    });
    api('/users/skills').then((d) => setSkills(d.skills));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    api(`/shifts?locationId=${locationId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((d) => setShifts(d.shifts))
      .catch((e) => setError(e));
  }, [locationId, weekStart, from, to, reload, live?.tick]);

  const location = locations.find((l) => l.id === Number(locationId));
  const days = weekDays(weekStart);

  async function publish(unpublish = false) {
    setError(null);
    try {
      await api(unpublish ? '/shifts/weeks/unpublish' : '/shifts/weeks/publish', {
        method: 'POST',
        body: { locationId: Number(locationId), weekStart },
      });
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="eyebrow">{location?.timezone}</p>
          <h1>Week of {DateTime.fromISO(weekStart).toFormat('d LLL yyyy')}</h1>
        </div>
        <div className="toolbar">
          <select value={locationId || ''} onChange={(e) => setLocationId(Number(e.target.value))}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setWeekStart(DateTime.fromISO(weekStart).minus({ days: 7 }).toISODate())}>
            ←
          </button>
          <button type="button" onClick={() => setWeekStart(DateTime.fromISO(weekStart).plus({ days: 7 }).toISODate())}>
            →
          </button>
          <button type="button" className="primary" onClick={() => setForm({ date: weekStart, startTime: '17:00', endTime: '23:00', skillId: 1, headcount: 1 })}>
            New shift
          </button>
          <button type="button" onClick={() => publish(false)}>
            Publish week
          </button>
          <button type="button" onClick={() => publish(true)}>
            Unpublish
          </button>
        </div>
      </header>
      <ConstraintBanner error={error} />
      <div className="week-grid">
        {days.map((day) => {
          const iso = day.toISODate();
          const dayShifts = shifts.filter((s) => s.localDate === iso);
          return (
            <section key={iso}>
              <h3>
                {day.toFormat('ccc d')}
                <small>{day.toFormat('LLL')}</small>
              </h3>
              {dayShifts.map((s) => (
                <article key={s.id} className={`shift ${s.status} ${s.premium ? 'premium' : ''}`}>
                  <header>
                    <strong>
                      {s.localStart}–{s.localEnd}
                    </strong>
                    {s.overnight ? <span className="pill">overnight</span> : null}
                    {s.premium ? <span className="pill gold">premium</span> : null}
                  </header>
                  <p>
                    {s.skillName} · {s.assignments.length}/{s.headcount}
                  </p>
                  <ul>
                    {s.assignments.map((a) => (
                      <li key={a.id}>{a.name}</li>
                    ))}
                  </ul>
                  <footer>
                    <button type="button" onClick={() => setAssign(s)}>
                      Assign
                    </button>
                    <button type="button" onClick={() => setForm({ ...s, date: s.localDate, startTime: s.localStart, endTime: s.localEnd })}>
                      Edit
                    </button>
                    <button type="button" onClick={() => api(`/shifts/${s.id}/history`).then((d) => setHistory(d.history))}>
                      History
                    </button>
                  </footer>
                </article>
              ))}
            </section>
          );
        })}
      </div>
      {form ? (
        <ShiftForm
          form={form}
          skills={skills}
          locationId={locationId}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
      {assign ? (
        <AssignModal
          shift={assign}
          onClose={() => setAssign(null)}
          onDone={() => {
            setAssign(null);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
      {history ? (
        <div className="modal">
          <div className="card wide">
            <h2>Shift history</h2>
            <ul>
              {history.map((h) => (
                <li key={h.id}>
                  {h.action} by {h.email || 'system'} at {String(h.created_at)}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setHistory(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShiftForm({ form, skills, locationId, onClose, onSaved }) {
  const [data, setData] = useState(form);
  const [error, setError] = useState(null);
  async function save(e) {
    e.preventDefault();
    try {
      if (data.id) {
        await api(`/shifts/${data.id}`, {
          method: 'PATCH',
          body: {
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            skillId: Number(data.skillId),
            headcount: Number(data.headcount),
          },
        });
      } else {
        await api('/shifts', {
          method: 'POST',
          body: {
            locationId: Number(locationId),
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
            skillId: Number(data.skillId),
            headcount: Number(data.headcount),
          },
        });
      }
      onSaved();
    } catch (err) {
      setError(err);
    }
  }
  return (
    <div className="modal">
      <form className="card" onSubmit={save}>
        <h2>{data.id ? 'Edit shift' : 'Create shift'}</h2>
        <ConstraintBanner error={error} />
        <label>
          Date
          <input value={data.date} onChange={(e) => setData({ ...data, date: e.target.value })} />
        </label>
        <div className="row">
          <label>
            Start
            <input value={data.startTime} onChange={(e) => setData({ ...data, startTime: e.target.value })} />
          </label>
          <label>
            End
            <input value={data.endTime} onChange={(e) => setData({ ...data, endTime: e.target.value })} />
          </label>
        </div>
        <label>
          Skill
          <select value={data.skillId} onChange={(e) => setData({ ...data, skillId: e.target.value })}>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Headcount
          <input type="number" min="1" value={data.headcount} onChange={(e) => setData({ ...data, headcount: e.target.value })} />
        </label>
        <div className="row">
          <button type="submit" className="primary">
            Save
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function AssignModal({ shift, onClose, onDone }) {
  const [people, setPeople] = useState([]);
  const [whatIf, setWhatIf] = useState(null);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState('');
  useEffect(() => {
    api(`/shifts/${shift.id}/eligible`).then((d) => setPeople(d.people));
  }, [shift.id]);

  async function preview(userId) {
    setError(null);
    try {
      await api(`/shifts/${shift.id}/lock`, { method: 'POST', body: { userId } });
      const data = await api(`/shifts/${shift.id}/what-if`, { method: 'POST', body: { userId } });
      setWhatIf({ userId, ...data });
    } catch (e) {
      setError(e);
    }
  }

  async function confirm() {
    try {
      await api(`/shifts/${shift.id}/assign`, {
        method: 'POST',
        body: { userId: whatIf.userId, overrideReason: reason || undefined },
      });
      onDone();
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="modal">
      <div className="card wide">
        <h2>Assign {shift.skillName}</h2>
        <p className="muted">
          {shift.localLabel}. Times are {shift.timezone}.
        </p>
        <ConstraintBanner error={error} onPick={preview} />
        {whatIf?.warnings?.length ? (
          <div className="banner warn">
            {whatIf.warnings.map((w) => (
              <p key={w.rule}>{w.message}</p>
            ))}
            <p>
              What-if: {whatIf.labor?.week?.toFixed?.(1)} weekly hours, {whatIf.labor?.day?.toFixed?.(1)} daily.
            </p>
          </div>
        ) : null}
        <ul className="people">
          {people.map((p) => (
            <li key={p.userId}>
              <button type="button" onClick={() => preview(p.userId)}>
                {p.name}
              </button>
              <small>{p.weeklyHours?.toFixed?.(1)}h this week</small>
            </li>
          ))}
        </ul>
        {whatIf && !whatIf.ok ? null : whatIf ? (
          <>
            <label>
              7th-day override reason (if required)
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button type="button" className="primary" onClick={confirm}>
              Confirm assignment
            </button>
          </>
        ) : null}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
