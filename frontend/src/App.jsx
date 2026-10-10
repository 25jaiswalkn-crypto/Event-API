import { useEffect, useState } from 'react';

const API = 'http://localhost:3000/api';

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

  const tab = (name, label) => (
    <button className={page === name ? 'active' : ''} onClick={() => setPage(name)}>
      {label}
    </button>
  );

  return (
    <>
      <nav>
        <span className="brand">EventHub</span>
        {tab('events', 'Events')}
        {user && tab('mine', 'My Registrations')}
        {user?.role === 'admin' && tab('admin', 'Admin')}
        {!user && tab('login', 'Login')}
        {!user && tab('signup', 'Sign up')}
        {user && <span>Hi, {user.name}</span>}
        {user && <button onClick={logout}>Logout</button>}
      </nav>
      <div className="container">
        {page === 'events' && <EventsPage token={token} user={user} goLogin={() => setPage('login')} />}
        {page === 'mine' && <MyRegistrations token={token} />}
        {page === 'admin' && <AdminPage token={token} />}
        {page === 'login' && <AuthForm mode="login" onDone={login} />}
        {page === 'signup' && <AuthForm mode="signup" onDone={login} />}
      </div>
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
    <div className="card form">
      <h2>{mode === 'login' ? 'Login' : 'Create account'}</h2>
      {mode === 'signup' && <input placeholder="Name" value={form.name} onChange={set('name')} />}
      <input placeholder="Email" value={form.email} onChange={set('email')} />
      <input placeholder="Password" type="password" value={form.password} onChange={set('password')} />
      {error && <div className="error">{error}</div>}
      <button className="btn" onClick={submit}>
        {mode === 'login' ? 'Login' : 'Sign up'}
      </button>
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
      setMessage(registered ? 'Unregistered.' : 'Registered successfully!');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const categories = [...new Set(events.map((e) => e.category).filter(Boolean))];

  return (
    <>
      <h1>Events</h1>
      <div className="row">
        <input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
      {events.length === 0 && <p className="muted">No events found.</p>}
      {events.map((ev) => {
        const registered = mine.includes(ev.id);
        const full = ev.registered_count >= ev.capacity;
        return (
          <div className="card" key={ev.id}>
            <h3>{ev.title} {ev.category && <span className="badge">{ev.category}</span>}</h3>
            <div className="muted">
              {new Date(ev.date_time).toLocaleString()} · {ev.venue}
            </div>
            <p>
              <span className={full ? 'badge full' : 'badge'}>
                {ev.registered_count} / {ev.capacity} {full ? '(Full)' : 'registered'}
              </span>
            </p>
            {openId === ev.id && <p>{ev.description || 'No description.'}</p>}
            <div className="row">
              <button className="btn gray" onClick={() => setOpenId(openId === ev.id ? null : ev.id)}>
                {openId === ev.id ? 'Hide details' : 'View details'}
              </button>
              <button
                className={registered ? 'btn red' : 'btn'}
                disabled={!registered && full}
                onClick={() => toggle(ev, registered)}
              >
                {registered ? 'Unregister' : full ? 'Full' : 'Register'}
              </button>
            </div>
          </div>
        );
      })}
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
      <h1>My Registrations</h1>
      {error && <div className="error">{error}</div>}
      {rows.length === 0 && <p className="muted">You have not registered for any events yet.</p>}
      {rows.map((r) => (
        <div className="card" key={r.registration_id}>
          <h3>{r.title}</h3>
          <div className="muted">
            {new Date(r.date_time).toLocaleString()} · {r.venue}
          </div>
          <p>{r.description}</p>
        </div>
      ))}
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
      <h1>Admin: Manage Events</h1>
      <div className="card form">
        <h3>{editId ? 'Edit event' : 'Create event'}</h3>
        <input placeholder="Title" value={form.title} onChange={set('title')} />
        <textarea placeholder="Description" value={form.description} onChange={set('description')} />
        <input type="datetime-local" value={form.date_time} onChange={set('date_time')} />
        <input placeholder="Venue" value={form.venue} onChange={set('venue')} />
        <input placeholder="Capacity" type="number" value={form.capacity} onChange={set('capacity')} />
        <input placeholder="Category" value={form.category} onChange={set('category')} />
        {error && <div className="error">{error}</div>}
        <div className="row">
          <button className="btn" onClick={save}>{editId ? 'Update' : 'Create'}</button>
          {editId && (
            <button className="btn gray" onClick={() => { setEditId(null); setForm(empty); }}>
              Cancel
            </button>
          )}
        </div>
      </div>
      {events.map((ev) => (
        <div className="card" key={ev.id}>
          <h3>{ev.title}</h3>
          <div className="muted">
            {new Date(ev.date_time).toLocaleString()} · {ev.venue} · {ev.registered_count}/{ev.capacity}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => startEdit(ev)}>Edit</button>
            <button className="btn red" onClick={() => remove(ev.id)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}