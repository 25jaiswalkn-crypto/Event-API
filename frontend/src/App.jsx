import { useCallback, useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/* ---------- API helper ---------- */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check that the API is running, then try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}

/* ---------- Helpers ---------- */

const pad = (n) => String(n).padStart(2, '0');
const isPast = (value) => new Date(value) < new Date();

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

// <input type="datetime-local"> only accepts "YYYY-MM-DDTHH:mm" in local time,
// so ISO strings from the API must be converted before editing.
function toLocalInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function when(value) {
  return new Date(value).toLocaleString('en', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/* ---------- Small shared components ---------- */

function DateCol({ value }) {
  const d = new Date(value);
  return (
    <div className="date" title={d.toLocaleDateString('en', { dateStyle: 'full' })}>
      <span className="day">{pad(d.getDate())}</span>
      <span className="mon">{d.toLocaleString('en', { month: 'short' })}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function SkeletonRows({ n = 3 }) {
  return (
    <div className="list" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      {Array.from({ length: n }, (_, i) => (
        <div className="skel-row" key={i} aria-hidden="true">
          <div className="skel" style={{ width: '38%', height: 26 }} />
          <div className="skel" style={{ width: '22%', height: 14, marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className={`toast ${toast.kind}`} role="status" aria-live="polite">
      <span>{toast.text}</span>
      <button aria-label="Dismiss message" onClick={onClose}>×</button>
    </div>
  );
}

/* ---------- App shell ---------- */

export default function App() {
  const [page, setPage] = useState('events');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(readUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, kind = 'ok') => setToast({ text, kind, id: Date.now() }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const go = useCallback((name) => {
    setPage(name);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  function login(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    go('events');
    notify(data.user?.name ? `Welcome, ${data.user.name}.` : 'You are logged in.');
  }

  const logout = useCallback(
    (message = 'You have been logged out.') => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken('');
      setUser(null);
      go('events');
      notify(message);
    },
    [go, notify]
  );

  // Pages call this when a request fails. An expired token (401) logs the user out;
  // for anything else it returns the message to show.
  const fail = useCallback(
    (e) => {
      if (e.status === 401) {
        logout('Your session expired. Log in again.');
        return '';
      }
      return e.message;
    },
    [logout]
  );

  const tab = (name, label, extra = '') => (
    <button
      className={`${page === name ? 'active' : ''} ${extra}`.trim()}
      aria-current={page === name ? 'page' : undefined}
      onClick={() => go(name)}
    >
      {label}
    </button>
  );

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <nav>
        <button className="brand" onClick={() => go('events')}>
          <span className="mark" /> EventHub
        </button>
        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="nav-links"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
        <div id="nav-links" className={`links ${menuOpen ? 'open' : ''}`}>
          {tab('events', 'Events')}
          {user && tab('mine', 'My registrations')}
          {user?.role === 'admin' && tab('admin', 'Admin')}
          {!user && tab('login', 'Log in')}
          {!user && tab('signup', 'Sign up', 'cta')}
          {user && <span className="hello">{user.name}</span>}
          {user && <button onClick={() => logout()}>Log out</button>}
        </div>
      </nav>

      <main id="main" className="container" key={page}>
        {page === 'events' && (
          <EventsPage token={token} user={user} goLogin={() => go('login')} notify={notify} fail={fail} />
        )}
        {page === 'mine' && user && (
          <MyRegistrations token={token} notify={notify} fail={fail} goEvents={() => go('events')} />
        )}
        {page === 'admin' && user?.role === 'admin' && <AdminPage token={token} notify={notify} fail={fail} />}
        {page === 'login' && <AuthForm mode="login" onDone={login} switchTo={() => go('signup')} />}
        {page === 'signup' && <AuthForm mode="signup" onDone={login} switchTo={() => go('login')} />}
      </main>

      <footer>
        <span>EventHub</span>
        <span>GDG RBU Recruitment 2026-27</span>
      </footer>

      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}

/* ---------- Log in / Sign up ---------- */

function AuthForm({ mode, onDone, switchTo }) {
  const isLogin = mode === 'login';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    const email = form.email.trim();
    const name = form.name.trim();
    if (!isLogin && !name) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (!form.password) return setError('Enter your password.');
    if (!isLogin && form.password.length < 6) return setError('Use a password with at least 6 characters.');

    setBusy(true);
    try {
      if (!isLogin) {
        await api('/auth/register', { method: 'POST', body: { name, email, password: form.password } });
      }
      const data = await api('/auth/login', { method: 'POST', body: { email, password: form.password } });
      onDone(data);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="form-block form" onSubmit={submit} noValidate>
        <div className="label">{isLogin ? 'Account / Log in' : 'Account / Sign up'}</div>
        <h2>{isLogin ? 'Welcome back.' : 'Create your account.'}</h2>
        {!isLogin && (
          <Field label="Name">
            <input value={form.name} onChange={set('name')} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
        </Field>
        {error && <div className="error" role="alert" style={{ margin: 0 }}>{error}</div>}
        <div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="link" onClick={switchTo}>
            {isLogin ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}

/* ---------- Events ---------- */

function EventsPage({ token, user, goLogin, notify, fail }) {
  const [events, setEvents] = useState(null); // null = still loading
  const [mine, setMine] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const q = useDebounced(search);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const params = new URLSearchParams();
      if (q.trim()) params.set('search', q.trim());
      if (category) params.set('category', category);

      try {
        const list = await api(`/events?${params}`);
        if (cancelled) return;
        setEvents(list);
        setError('');
        // Remember every category seen so the dropdown doesn't shrink while filtering.
        setCategories((prev) => [...new Set([...prev, ...list.map((e) => e.category).filter(Boolean)])].sort());
      } catch (e) {
        if (cancelled) return;
        setEvents((prev) => prev ?? []);
        setError(e.message);
      }

      if (!token) {
        if (!cancelled) setMine([]);
        return;
      }
      try {
        const r = await api('/registrations/me', { token });
        if (!cancelled) setMine(r.map((x) => x.event_id));
      } catch (e) {
        if (cancelled) return;
        const m = fail(e);
        if (m) setError(m);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, category, token, reloadKey, fail]);

  async function toggle(ev, registered) {
    if (!user) {
      notify('Log in to register for an event.');
      return goLogin();
    }
    setBusyId(ev.id);
    try {
      await api(`/events/${ev.id}/register`, { method: registered ? 'DELETE' : 'POST', token });
      notify(registered ? `You left ${ev.title}.` : `You're registered for ${ev.title}.`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      const m = fail(e);
      if (m) notify(m, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const filtering = Boolean(q.trim() || category);

  return (
    <>
      <div className="hero">
        <div className="hero-top">
          <span className="label">Campus events</span>
          <span className="label">{events ? `${pad(events.length)} listed` : 'Loading'}</span>
        </div>
        <h1>
          Events<span>.</span>
        </h1>
        <div className="hero-bottom">
          <p>Workshops, hackathons and meetups. Browse the list, pick one and reserve your seat.</p>
        </div>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Search events"
          aria-label="Search events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button className="link" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
        </div>
      )}

      {events === null && <SkeletonRows />}

      {events && events.length === 0 && !error && (
        <div className="empty">
          {filtering ? 'No events match your search.' : 'No events yet. Check back soon.'}
          {filtering && (
            <div style={{ marginTop: 16 }}>
              <button className="btn gray" onClick={() => { setSearch(''); setCategory(''); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {events && events.length > 0 && (
        <div className="list">
          {events.map((ev, i) => {
            const registered = mine.includes(ev.id);
            const left = ev.capacity - ev.registered_count;
            const full = left <= 0;
            const past = isPast(ev.date_time);
            const low = !full && !past && left <= Math.max(1, Math.ceil(ev.capacity * 0.2));
            const pct = ev.capacity > 0 ? Math.min(100, (ev.registered_count / ev.capacity) * 100) : 100;
            const busy = busyId === ev.id;
            const open = openId === ev.id;

            let seatText = `${left} left`;
            let seatClass = 'big';
            if (past) { seatText = 'Ended'; seatClass = 'big ended'; }
            else if (full) { seatText = 'Sold out'; seatClass = 'big full'; }
            else if (low) seatClass = 'big low';

            let label = 'Register';
            let btnClass = 'btn';
            let disabled = false;
            if (busy) { label = 'Saving…'; disabled = true; }
            else if (registered && past) { label = 'Registered'; disabled = true; }
            else if (registered) { label = 'Leave'; btnClass = 'btn red'; }
            else if (past) { label = 'Ended'; disabled = true; }
            else if (full) { label = 'Full'; disabled = true; }

            return (
              <div className={`row-item${past ? ' past' : ''}`} key={ev.id}>
                <div className="idx">{pad(i + 1)}</div>
                <DateCol value={ev.date_time} />
                <div className="main">
                  <h3>
                    {ev.title}
                    {registered && <span className="tag">Registered</span>}
                  </h3>
                  <div className="muted">{when(ev.date_time)} · {ev.venue}</div>
                  {open && <p className="desc">{ev.description || 'No description yet.'}</p>}
                </div>
                <div className={ev.category ? 'cat' : 'cat none'}>{ev.category || '—'}</div>
                <div className="seats">
                  <div className={seatClass}>{seatText}</div>
                  <div className="small">{ev.registered_count} of {ev.capacity} seats taken</div>
                  <div className={full || low ? 'bar full' : 'bar'}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="btn gray"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : ev.id)}
                  >
                    {open ? 'Close' : 'Details'}
                  </button>
                  <button className={btnClass} disabled={disabled} onClick={() => toggle(ev, registered)}>
                    {label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- My registrations ---------- */

function MyRegistrations({ token, notify, fail, goEvents }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api('/registrations/me', { token })
      .then((r) => { if (!cancelled) setRows(r); })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        const m = fail(e);
        if (m) setError(m);
      });
    return () => {
      cancelled = true;
    };
  }, [token, fail]);

  async function leave(r) {
    setBusyId(r.registration_id);
    try {
      await api(`/events/${r.event_id}/register`, { method: 'DELETE', token });
      setRows((rs) => rs.filter((x) => x.registration_id !== r.registration_id));
      notify(`You left ${r.title}.`);
    } catch (e) {
      const m = fail(e);
      if (m) notify(m, 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="page-title">My<br />registrations<span style={{ color: 'var(--red)' }}>.</span></h1>
      {error && <div className="error" role="alert">{error}</div>}
      {rows === null && <SkeletonRows n={2} />}
      {rows && rows.length === 0 && !error && (
        <div className="empty">
          You haven't registered for any events yet.
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={goEvents}>Browse events</button>
          </div>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="list">
          {rows.map((r, i) => {
            const past = isPast(r.date_time);
            return (
              <div className={`row-item simple${past ? ' past' : ''}`} key={r.registration_id}>
                <div className="idx">{pad(i + 1)}</div>
                <DateCol value={r.date_time} />
                <div className="main">
                  <h3>{r.title}</h3>
                  <div className="muted">{when(r.date_time)} · {r.venue}</div>
                  {r.description && <p className="desc">{r.description}</p>}
                </div>
                <div className={r.category ? 'cat' : 'cat none'}>{r.category || '—'}</div>
                <div className="actions">
                  <button
                    className="btn red"
                    disabled={past || busyId === r.registration_id}
                    onClick={() => leave(r)}
                  >
                    {past ? 'Ended' : busyId === r.registration_id ? 'Saving…' : 'Leave'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------- Admin ---------- */

const emptyForm = { title: '', description: '', date_time: '', venue: '', capacity: '', category: '' };

function AdminPage({ token, notify, fail }) {
  const [events, setEvents] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(
    () =>
      api('/events')
        .then(setEvents)
        .catch((e) => {
          setEvents((prev) => prev ?? []);
          setError(e.message);
        }),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setEditId(null);
    setForm(emptyForm);
    setError('');
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const capacity = Number(form.capacity);
    if (!form.title.trim()) return setError('Enter a title.');
    if (!form.date_time) return setError('Choose a date and time.');
    if (!form.venue.trim()) return setError('Enter a venue.');
    if (!Number.isInteger(capacity) || capacity < 1) return setError('Capacity must be a whole number, 1 or more.');
    const current = events?.find((x) => x.id === editId);
    if (current && capacity < current.registered_count) {
      return setError(`${current.registered_count} people are already registered, so capacity can't go lower than that.`);
    }

    const body = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      venue: form.venue.trim(),
      category: form.category.trim(),
      capacity,
    };

    setSaving(true);
    try {
      if (editId) await api(`/events/${editId}`, { method: 'PUT', body, token });
      else await api('/events', { method: 'POST', body, token });
      notify(editId ? 'Event updated.' : 'Event created.');
      reset();
      load();
    } catch (err) {
      const m = fail(err);
      if (m) setError(m);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(ev) {
    setError('');
    setEditId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description || '',
      date_time: toLocalInput(ev.date_time),
      venue: ev.venue,
      capacity: ev.capacity,
      category: ev.category || '',
    });
    window.scrollTo({ top: 0 });
  }

  async function remove(ev) {
    if (!confirm(`Delete "${ev.title}"? This can't be undone.`)) return;
    try {
      await api(`/events/${ev.id}`, { method: 'DELETE', token });
      if (editId === ev.id) reset();
      notify('Event deleted.');
      load();
    } catch (e) {
      const m = fail(e);
      if (m) notify(m, 'error');
    }
  }

  const knownCategories = [...new Set((events || []).map((e) => e.category).filter(Boolean))];

  return (
    <>
      <h1 className="page-title">Manage<br />events<span style={{ color: 'var(--red)' }}>.</span></h1>
      <form className="form-block form admin-form" onSubmit={save} noValidate>
        <div className="label">{editId ? 'Edit event' : 'New event'}</div>
        <Field label="Title">
          <input value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={set('description')} />
        </Field>
        <div className="form-row">
          <Field label="Date and time">
            <input type="datetime-local" value={form.date_time} onChange={set('date_time')} />
          </Field>
          <Field label="Capacity">
            <input type="number" min="1" step="1" value={form.capacity} onChange={set('capacity')} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Venue">
            <input value={form.venue} onChange={set('venue')} />
          </Field>
          <Field label="Category">
            <input list="category-options" value={form.category} onChange={set('category')} />
            <datalist id="category-options">
              {knownCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
        </div>
        {error && <div className="error" role="alert" style={{ margin: 0 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Create event'}
          </button>
          {editId && (
            <button className="btn gray" type="button" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {events === null && <SkeletonRows n={2} />}
      {events && events.length === 0 && !error && (
        <div className="empty">No events yet. Create the first one above.</div>
      )}
      {events && events.length > 0 && (
        <div className="list" style={{ borderTop: '2px solid var(--text)' }}>
          {events.map((ev, i) => (
            <div
              className={`row-item${isPast(ev.date_time) ? ' past' : ''}${editId === ev.id ? ' editing' : ''}`}
              key={ev.id}
            >
              <div className="idx">{pad(i + 1)}</div>
              <DateCol value={ev.date_time} />
              <div className="main">
                <h3>{ev.title}</h3>
                <div className="muted">{when(ev.date_time)} · {ev.venue}</div>
              </div>
              <div className={ev.category ? 'cat' : 'cat none'}>{ev.category || '—'}</div>
              <div className="seats">
                <div className="big">{ev.registered_count} / {ev.capacity}</div>
                <div className="small">registered</div>
              </div>
              <div className="actions">
                <button className="btn gray" onClick={() => startEdit(ev)}>Edit</button>
                <button className="btn red" onClick={() => remove(ev)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}