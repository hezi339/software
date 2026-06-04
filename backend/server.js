require('./loadEnv');

const express = require('express');
const cors = require('cors');
const path = require('path');
const userRoutes = require('./routes/users');
const petRoutes = require('./routes/pets');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.use('/api/users', userRoutes);
app.use('/api/pets', petRoutes);

app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'petcare_plus_cute.html'));
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/users`);
  console.log(`API: http://localhost:${PORT}/api/pets`);
});
