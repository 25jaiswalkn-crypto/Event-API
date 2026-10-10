import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const pad = (n) => String(n).padStart(2, '0');

function DateCol({ value }) {
  const d = new Date(value);
  return (
    <div className="date">
      <span className="day">{pad(d.getDate())}</span>
      <span className="mon">{d.toLocaleString('en', { month: 'short' })}</span>
    </div>
  );
}

function when(value) {
  return new Date(value).toLocaleString('en', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function App() {
  const [page, setPage] = useState('events');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  function login(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setPage('events');
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setPage('events');
  }

  const tab = (name, label, extra = '') => (
    <button className={`${page === name ? 'active' : ''} ${extra}`} onClick={() => setPage(name)}>
      {label}
    </button>
  );

  return (
    <>
      <nav>
        <span className="brand">
          <span className="mark" /> EventHub
        </span>
        {tab('events', 'Events')}
        {user && tab('mine', 'My registrations')}
        {user?.role === 'admin' && tab('admin', 'Admin')}
        {!user && tab('login', 'Log in')}
        {!user && tab('signup', 'Sign up', 'cta')}
        {user && <span className="hello">{user.name}</span>}
        {user && <button onClick={logout}>Log out</button>}
      </nav>
      <div className="container">
        {page === 'events' && <EventsPage token={token} user={user} goLogin={() => setPage('login')} />}
        {page === 'mine' && <MyRegistrations token={token} />}
        {page === 'admin' && <AdminPage token={token} />}
        {page === 'login' && <AuthForm mode="login" onDone={login} />}
        {page === 'signup' && <AuthForm mode="signup" onDone={login} />}
      </div>
      <footer>
        <span>EventHub</span>
        <span>GDG RBU Recruitment 2026-27</span>
      </footer>
    </>
  );
}

function AuthForm({ mode, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setError('');
    try {
      if (mode === 'signup') {
        await api('/auth/register', { method: 'POST', body: form });
      }
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: form.email, password: form.password },
      });
      onDone(data);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="form-block form">
        <div className="label">{mode === 'login' ? 'Account / Log in' : 'Account / Sign up'}</div>
        <h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2>
        {mode === 'signup' && <input placeholder="Name" value={form.name} onChange={set('name')} />}
        <input placeholder="Email" value={form.email} onChange={set('email')} />
        <input placeholder="Password" type="password" value={form.password} onChange={set('password')} />
        {error && <div className="error" style={{ margin: 0 }}>{error}</div>}
        <div>
          <button className="btn" onClick={submit}>
            {mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventsPage({ token, user, goLogin }) {
  const [events, setEvents] = useState([]);
  const [mine, setMine] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    try {
      setEvents(await api(`/events?${params}`));
      if (token) {
        const r = await api('/registrations/me', { token });
        setMine(r.map((x) => x.event_id));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [search, category, token]);

  async function toggle(ev, registered) {
    if (!user) return goLogin();
    setMessage('');
    setError('');
    try {
      await api(`/events/${ev.id}/register`, { method: registered ? 'DELETE' : 'POST', token });
      setMessage(registered ? 'You have been unregistered.' : 'You are registered. See you there.');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const categories = [...new Set(events.map((e) => e.category).filter(Boolean))];

  return (
    <>
      <div className="hero">
        <div className="hero-top">
          <span className="label">Campus events</span>
          <span className="label">{pad(events.length)} listed</span>
        </div>
        <h1>
          Events<span>.</span>
        </h1>
        <div className="hero-bottom">
          <p>Workshops, hackathons and meetups. Browse the list, pick one and reserve your seat.</p>
        </div>
      </div>

      <div className="filters">
        <input placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
      {events.length === 0 && <div className="empty">No events found.</div>}

      <div className="list">
        {events.map((ev, i) => {
          const registered = mine.includes(ev.id);
          const left = ev.capacity - ev.registered_count;
          const full = left <= 0;
          const pct = Math.min(100, (ev.registered_count / ev.capacity) * 100);
          return (
            <div className="row-item" key={ev.id}>
              <div className="idx">{pad(i + 1)}</div>
              <DateCol value={ev.date_time} />
              <div className="main">
                <h3>{ev.title}</h3>
                <div className="muted">{when(ev.date_time)} · {ev.venue}</div>
                {openId === ev.id && <p className="desc">{ev.description || 'No description.'}</p>}
              </div>
              <div className="cat">{ev.category || '—'}</div>
              <div className="seats">
                <div className={full ? 'big full' : 'big'}>{full ? 'Sold out' : `${left} left`}</div>
                <div className="small">{ev.registered_count} of {ev.capacity} seats</div>
                <div className={full ? 'bar full' : 'bar'}>
                  <div style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="actions">
                <button className="btn gray" onClick={() => setOpenId(openId === ev.id ? null : ev.id)}>
                  {openId === ev.id ? 'Close' : 'Details'}
                </button>
                <button
                  className={registered ? 'btn red' : 'btn'}
                  disabled={!registered && full}
                  onClick={() => toggle(ev, registered)}
                >
                  {registered ? 'Leave' : full ? 'Full' : 'Register'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function MyRegistrations({ token }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/registrations/me', { token }).then(setRows).catch((e) => setError(e.message));
  }, [token]);

  return (
    <>
      <h1 className="page-title">My<br />registrations<span style={{ color: 'var(--red)' }}>.</span></h1>
      {error && <div className="error">{error}</div>}
      {rows.length === 0 && <div className="empty">You have not registered for any events yet.</div>}
      <div className="list">
        {rows.map((r, i) => (
          <div className="row-item simple" key={r.registration_id}>
            <div className="idx">{pad(i + 1)}</div>
            <DateCol value={r.date_time} />
            <div className="main">
              <h3>{r.title}</h3>
              <div className="muted">{when(r.date_time)} · {r.venue}</div>
              {r.description && <p className="desc">{r.description}</p>}
            </div>
            <div className="cat">{r.category || '—'}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminPage({ token }) {
  const empty = { title: '', description: '', date_time: '', venue: '', capacity: '', category: '' };
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = () => api('/events').then(setEvents).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setError('');
    const body = { ...form, capacity: Number(form.capacity) };
    try {
      if (editId) await api(`/events/${editId}`, { method: 'PUT', body, token });
      else await api('/events', { method: 'POST', body, token });
      setForm(empty);
      setEditId(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function startEdit(ev) {
    setEditId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description || '',
      date_time: ev.date_time,
      venue: ev.venue,
      capacity: ev.capacity,
      category: ev.category || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id) {
    if (!confirm('Delete this event?')) return;
    try {
      await api(`/events/${id}`, { method: 'DELETE', token });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <h1 className="page-title">Manage<br />events<span style={{ color: 'var(--red)' }}>.</span></h1>
      <div className="form-block form admin-form">
        <div className="label">{editId ? 'Edit event' : 'New event'}</div>
        <input placeholder="Title" value={form.title} onChange={set('title')} />
        <textarea placeholder="Description" value={form.description} onChange={set('description')} />
        <input type="datetime-local" value={form.date_time} onChange={set('date_time')} />
        <input placeholder="Venue" value={form.venue} onChange={set('venue')} />
        <input placeholder="Capacity" type="number" value={form.capacity} onChange={set('capacity')} />
        <input placeholder="Category" value={form.category} onChange={set('category')} />
        {error && <div className="error" style={{ margin: 0 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={save}>{editId ? 'Update event' : 'Create event'}</button>
          {editId && (
            <button className="btn gray" onClick={() => { setEditId(null); setForm(empty); }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="list" style={{ borderTop: '2px solid var(--text)' }}>
        {events.map((ev, i) => (
          <div className="row-item" key={ev.id}>
            <div className="idx">{pad(i + 1)}</div>
            <DateCol value={ev.date_time} />
            <div className="main">
              <h3>{ev.title}</h3>
              <div className="muted">{ev.venue}</div>
            </div>
            <div className="cat">{ev.category || '—'}</div>
            <div className="seats">
              <div className="big">{ev.registered_count} / {ev.capacity}</div>
              <div className="small">registered</div>
            </div>
            <div className="actions">
              <button className="btn gray" onClick={() => startEdit(ev)}>Edit</button>
              <button className="btn red" onClick={() => remove(ev.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}