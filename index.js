require('dotenv').config();
const express = require('express');
require('./db');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Event API is running!' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/event'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});