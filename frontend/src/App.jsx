import { useEffect, useState } from 'react';

const API = 'http://localhost:3000/api';

export default function App() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/events`)
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setError('Could not reach the API. Is the backend running?'));
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Events</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {events.map((e) => (
        <div key={e.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <h3>{e.title}</h3>
          <p>{e.description}</p>
          <p>
            {new Date(e.date_time).toLocaleString()} · {e.venue} · {e.category}
          </p>
          <p>
            {e.registered_count} / {e.capacity} registered
          </p>
        </div>
      ))}
    </div>
  );
}