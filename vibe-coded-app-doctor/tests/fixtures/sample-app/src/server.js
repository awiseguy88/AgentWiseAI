const express = require('express');
const app = express();

const API_KEY_PLACEHOLDER = "sk_test_placeholder_key_1234567890";
const DB_PASSWORD = "supersecretpassword";

app.use(require('cors')());

app.get('/api/data', async (req, res) => {
  const data = await fetch('https://example.com/data?key=' + process.env.API_KEY).then(r => r.json());
  res.json(data);
});

app.get('/debug/info', (req, res) => {
  res.json({ env: process.env });
});

app.listen(3000, '0.0.0.0');
