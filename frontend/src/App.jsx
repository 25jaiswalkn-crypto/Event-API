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
const byDateAsc = (a, b) => new Date(a.date_time) - new Date(b.date_time);
const byDateDesc = (a, b) => new Date(b.date_time) - new Date(a.date_time);

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

function fullDate(value) {
  return new Date(value).toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' });
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function relative(value) {
  const d = new Date(value);
  const now = new Date();
  if (d < now) return 'Ended';
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

// The club's own palette (same colours as the GDG site navigation).
const PALETTE = ['var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--purple)', 'var(--coral)'];
function catColor(name) {
  let sum = 0;
  for (const ch of name.toLowerCase()) sum += ch.charCodeAt(0);
  return PALETTE[sum % PALETTE.length];
}
// An event takes its category's colour; uncategorised events get one from their title.
const eventColor = (ev) => catColor(ev.category || ev.title || 'event');

// Everything the UI needs to know about one event for the current user.
function eventState(ev, registered, busy) {
  const left = ev.capacity - ev.registered_count;
  const full = left <= 0;
  const past = isPast(ev.date_time);
  const low = !full && !past && left <= Math.max(1, Math.ceil(ev.capacity * 0.2));

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

  return { left, full, past, low, seatText, seatClass, label, btnClass, disabled };
}

function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/* ---------- Brand pieces ---------- */

// The GDG code-brackets mark, drawn from four rounded bars in Google's colours.
// To use the official artwork instead, replace the four <path> elements with it.
function GdgLogo({ size = 28 }) {
  return (
    <svg
      className="gdg-logo"
      viewBox="8 9 57 38"
      width={size * 1.5}
      height={size}
      fill="none"
      strokeWidth="7"
      strokeLinecap="round"
      role="img"
      aria-label="GDG"
    >
      <path d="M29 13L12 25" stroke="#ea4335" />
      <path d="M12 25L29 43" stroke="#4285f4" />
      <path d="M43 13L61 27" stroke="#34a853" />
      <path d="M61 27L43 43" stroke="#fbbc04" />
    </svg>
  );
}

// Google-style four-dot loader.
function Loading({ label = 'Loading' }) {
  return (
    <div className="loading" role="status">
      <span className="dots" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>{label}</span>
    </div>
  );
}

// Seats drawn as a strip of blocks: filled blocks are taken seats.
// Colour comes from the surrounding element's --c.
function SeatStrip({ ev }) {
  const capacity = Math.max(ev.capacity, 1);
  const total = Math.min(capacity, 12);
  const full = ev.registered_count >= capacity;
  let filled = Math.round((ev.registered_count / capacity) * total);
  if (ev.registered_count > 0 && filled === 0) filled = 1;
  if (!full && filled >= total) filled = total - 1;
  if (full) filled = total;
  return (
    <div className="strip" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? 'on' : ''} />
      ))}
    </div>
  );
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

function CatChip({ name }) {
  return (
    <span className="catchip">
      <i className="dot" style={{ '--c': catColor(name) }} />
      {name}
    </span>
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

function Empty({ children }) {
  return (
    <div className="empty">
      <GdgLogo size={36} />
      {children}
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

  // Navigation buttons use the same raised, colourful style as the GDG site.
  const tab = (name, label, color) => (
    <button
      className={`pill c-${color}${page === name ? ' active' : ''}`}
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
          <GdgLogo size={28} /> EventHub
        </button>
        <button
          className="pill c-blue menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="nav-links"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
        <div id="nav-links" className={`links ${menuOpen ? 'open' : ''}`}>
          {tab('events', 'Events', 'yellow')}
          {user && tab('mine', 'My registrations', 'green')}
          {user?.role === 'admin' && tab('admin', 'Admin', 'purple')}
          {!user && tab('login', 'Log in', 'blue')}
          {!user && tab('signup', 'Sign up', 'coral')}
          {user && <span className="hello">{user.name}</span>}
          {user && <button className="pill c-white" onClick={() => logout()}>Log out</button>}
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
        <span className="foot-brand"><GdgLogo size={22} /> EventHub</span>
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
      <form
        className="form-block form"
        onSubmit={submit}
        noValidate
        style={{ '--c': isLogin ? 'var(--blue)' : 'var(--yellow)' }}
      >
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

      {isLogin ? (
        <aside className="auth-side">
          <GdgLogo size={40} />
          <h2>Your seats<br />are waiting.</h2>
          <ul>
            <li>See the events you've registered for.</li>
            <li>Leave a seat if your plans change.</li>
            <li>Register for what's coming next.</li>
          </ul>
        </aside>
      ) : (
        <aside className="auth-side signup">
          <GdgLogo size={40} />
          <h2>Sign up once.<br />Reserve any seat.</h2>
          <ol>
            <li>Create your account with a name and email.</li>
            <li>Pick a workshop, hackathon or meetup.</li>
            <li>Reserve your seat in one click.</li>
          </ol>
        </aside>
      )}
    </div>
  );
}

/* ---------- Events ---------- */

function NextCard({ ev, registered, busy, onToggle }) {
  const s = eventState(ev, registered, busy);
  const d = new Date(ev.date_time);
  return (
    <aside className="next" style={{ '--c': eventColor(ev) }} aria-label="Next event">
      <div className="next-top">
        <span className="label">Next up</span>
        <span className="label">{relative(ev.date_time)}</span>
      </div>
      <div className="next-body">
        <div className="next-date">
          <span className="next-day">{pad(d.getDate())}</span>
          <span className="next-mon">{d.toLocaleString('en', { month: 'long' })}</span>
        </div>
        <h2>{ev.title}</h2>
        <div className="next-meta">{when(ev.date_time)} · {ev.venue}</div>
        <div className="next-seats">{s.full ? 'Sold out' : `${s.left} of ${ev.capacity} seats left`}</div>
        <SeatStrip ev={ev} />
        <button className={s.btnClass} disabled={s.disabled} onClick={() => onToggle(registered)}>
          {s.label}
        </button>
      </div>
    </aside>
  );
}

function EventRow({ ev, registered, busy, open, onOpen, onToggle }) {
  const s = eventState(ev, registered, busy);
  return (
    <div className={`row-item${s.past ? ' past' : ''}`} style={{ '--c': eventColor(ev) }}>
      <DateCol value={ev.date_time} />
      <div className="main">
        <h3>
          {ev.title}
          {registered && <span className="tag">Registered</span>}
        </h3>
        <div className="muted">{when(ev.date_time)} · {ev.venue}</div>
      </div>
      <div className="cat">{ev.category && <CatChip name={ev.category} />}</div>
      <div className="seats">
        <div className={s.seatClass}>{s.seatText}</div>
        <div className="small">{ev.registered_count} of {ev.capacity} seats taken</div>
        <SeatStrip ev={ev} />
      </div>
      <div className="actions">
        <button className="btn gray" aria-expanded={open} onClick={onOpen}>
          {open ? 'Close' : 'Details'}
        </button>
        <button className={s.btnClass} disabled={s.disabled} onClick={() => onToggle(registered)}>
          {s.label}
        </button>
      </div>
      {open && (
        <div className="panel">
          <p>{ev.description || 'No description yet.'}</p>
          <dl className="facts">
            <div><dt>When</dt><dd>{fullDate(ev.date_time)}</dd></div>
            <div><dt>Where</dt><dd>{ev.venue}</dd></div>
            <div><dt>Seats</dt><dd>{Math.max(0, s.left)} of {ev.capacity} left</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}

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
        // Remember every category seen so the chips don't vanish while filtering.
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
  const upcoming = (events || []).filter((e) => !isPast(e.date_time)).sort(byDateAsc);
  const past = (events || []).filter((e) => isPast(e.date_time)).sort(byDateDesc);
  const featured = !filtering ? upcoming[0] : null;

  const rowFor = (ev) => (
    <EventRow
      key={ev.id}
      ev={ev}
      registered={mine.includes(ev.id)}
      busy={busyId === ev.id}
      open={openId === ev.id}
      onOpen={() => setOpenId(openId === ev.id ? null : ev.id)}
      onToggle={(registered) => toggle(ev, registered)}
    />
  );

  return (
    <>
      <section className="hero">
        <div className="hero-top">
          <span className="label">GDG campus events</span>
          <span className="label">{events ? `${pad(events.length)} listed` : 'Loading'}</span>
        </div>
        <div className={`hero-grid${featured ? '' : ' single'}`}>
          <div className="hero-copy">
            {/* Headline written as a code tag: only a developer club would. */}
            <h1 aria-label="Events">
              <span className="word" aria-hidden="true">
                <span className="br b1">&lt;</span>Events<span className="br b2">/</span><span className="br b3">&gt;</span>
              </span>
            </h1>
            <p>Workshops, hackathons and meetups. Browse the list, pick one and reserve your seat.</p>
          </div>
          {featured && (
            <NextCard
              ev={featured}
              registered={mine.includes(featured.id)}
              busy={busyId === featured.id}
              onToggle={(registered) => toggle(featured, registered)}
            />
          )}
        </div>
      </section>

      <div className="filters">
        <input
          type="search"
          placeholder="Search events"
          aria-label="Search events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {categories.length > 0 && (
          <div className="chips" role="group" aria-label="Filter by category">
            <button
              className={`chip all${category === '' ? ' on' : ''}`}
              aria-pressed={category === ''}
              onClick={() => setCategory('')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`chip${category === c ? ' on' : ''}`}
                style={{ '--c': catColor(c) }}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                <i className="dot" />
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button className="link" onClick={() => setReloadKey((k) => k + 1)}>Retry</button>
        </div>
      )}

      {events === null && <Loading label="Loading events" />}

      {events && events.length === 0 && !error && (
        <Empty>
          {filtering ? 'No events match your search.' : 'No events yet. Check back soon.'}
          {filtering && (
            <div style={{ marginTop: 16 }}>
              <button className="btn gray" onClick={() => { setSearch(''); setCategory(''); }}>
                Clear filters
              </button>
            </div>
          )}
        </Empty>
      )}

      {upcoming.length > 0 && <div className="list">{upcoming.map(rowFor)}</div>}

      {past.length > 0 && (
        <>
          <div className="divider">
            <span className="label">Past events</span>
            <span className="label">{pad(past.length)}</span>
          </div>
          <div className="list">{past.map(rowFor)}</div>
        </>
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
      <h1 className="page-title">My<br />registrations<span className="accent">.</span></h1>
      {error && <div className="error" role="alert">{error}</div>}
      {rows === null && <Loading label="Loading your registrations" />}
      {rows && rows.length === 0 && !error && (
        <Empty>
          You haven't registered for any events yet.
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={goEvents}>Browse events</button>
          </div>
        </Empty>
      )}
      {rows && rows.length > 0 && (
        <div className="list">
          {rows.map((r) => {
            const past = isPast(r.date_time);
            return (
              <div
                className={`row-item simple${past ? ' past' : ''}`}
                key={r.registration_id}
                style={{ '--c': eventColor(r) }}
              >
                <DateCol value={r.date_time} />
                <div className="main">
                  <h3>{r.title}</h3>
                  <div className="muted">{when(r.date_time)} · {r.venue} · {relative(r.date_time)}</div>
                  {r.description && <p className="desc">{r.description}</p>}
                </div>
                <div className="cat">{r.category && <CatChip name={r.category} />}</div>
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
      <h1 className="page-title">Manage<br />events<span className="accent">.</span></h1>
      <form
        className="form-block form admin-form"
        onSubmit={save}
        noValidate
        style={{ '--c': 'var(--purple)' }}
      >
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
        <div style={{ display: 'flex', gap: 12 }}>
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

      {events === null && <Loading label="Loading events" />}
      {events && events.length === 0 && !error && <Empty>No events yet. Create the first one above.</Empty>}
      {events && events.length > 0 && (
        <div className="list" style={{ borderTop: '2px solid var(--ink)' }}>
          {events.map((ev) => (
            <div
              className={`row-item${isPast(ev.date_time) ? ' past' : ''}${editId === ev.id ? ' editing' : ''}`}
              key={ev.id}
              style={{ '--c': eventColor(ev) }}
            >
              <DateCol value={ev.date_time} />
              <div className="main">
                <h3>{ev.title}</h3>
                <div className="muted">{when(ev.date_time)} · {ev.venue}</div>
              </div>
              <div className="cat">{ev.category && <CatChip name={ev.category} />}</div>
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