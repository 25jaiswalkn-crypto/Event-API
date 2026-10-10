const express = require('express');
const app = express();
require('./db');

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Event API is running!' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});