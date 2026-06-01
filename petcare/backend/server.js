const path = require('path');
const express = require('express');
const cors = require('cors');

function optionalRequire(moduleName, fallbackMiddleware) {
  try {
    return require(moduleName);
  } catch (error) {
    console.warn(`Optional dependency "${moduleName}" is unavailable, falling back to a no-op middleware.`);
    return fallbackMiddleware;
  }
}

const morgan = optionalRequire('morgan', () => (req, res, next) => next());
const helmet = optionalRequire('helmet', () => (req, res, next) => next());
const compression = optionalRequire('compression', () => (req, res, next) => next());

const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin.routes');
const petRoutes = require('./routes/pets');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(compression());
app.use(morgan('dev'));

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'petcare_plus_cute.html'));
});

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pets', petRoutes);

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is working!',
    port: PORT
  });
});

app.use((req, res) => {
  res.status(404).json({ message: '路径不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`服务启动成功: http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('未处理异常', err);
});
