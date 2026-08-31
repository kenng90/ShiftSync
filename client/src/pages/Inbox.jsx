import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLive } from '../SocketContext.jsx';

export default function Inbox() {
  const live = useLive();
  const [items, setItems] = useState([]);
  const [channel, setChannel] = useState('in_app');

  async function load() {
    const [notes, prefs] = await Promise.all([api('/notifications'), api('/notifications/preferences')]);
    setItems(notes.notifications);
    setChannel(prefs.channel);
  }

  useEffect(() => {
    load().catch(() => {});
  }, [live?.tick]);

  async function mark(id) {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    await load();
  }

  return (
    <div>
      <header className="page-head">
        <h1>Inbox</h1>
        <div className="row">
          <button type="button" onClick={() => api('/notifications/read-all', { method: 'POST' }).then(load)}>
            Mark all read
          </button>
          <label>
            Channel
            <select
              value={channel}
              onChange={async (e) => {
                const next = e.target.value;
                await api('/notifications/preferences', { method: 'PUT', body: { channel: next } });
                setChannel(next);
              }}
            >
              <option value="in_app">In-app only</option>
              <option value="in_app_email">In-app + email simulation</option>
            </select>
          </label>
        </div>
      </header>
      <p className="muted">Email simulation logs to the API console. Nothing is actually emailed.</p>
      <div className="stack">
        {items.map((n) => (
          <article key={n.id} className={`card ${n.readAt ? '' : 'unread'}`}>
            <strong>{n.title}</strong>
            <p>{n.body}</p>
            <small className="muted">{n.type}</small>
            {!n.readAt ? (
              <button type="button" onClick={() => mark(n.id)}>
                Mark read
              </button>
            ) : null}
          </article>
        ))}
        {!items.length ? <p className="muted">No notifications yet.</p> : null}
      </div>
    </div>
  );
}
