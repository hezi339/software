const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

// 引入路由
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin.routes');
const petRoutes = require('./routes/pets');

const app = express();
const PORT = process.env.PORT || 3000;

// 【关键修复】完全关闭CSP限制，适配你的内联事件/脚本
app.use(helmet({
  contentSecurityPolicy: false, // 彻底关闭内容安全策略，解决所有内联报错
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(compression());
app.use(morgan('dev'));

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 关键：托管public文件夹里的所有静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 关键：设置访问根路径时，自动打开public文件夹下的HTML文件
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'petcare_plus_cute.html'));
});

// 业务接口
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pets', petRoutes);

// 测试接口
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is working!',
    port: PORT
  });
});

// 错误处理
app.use((req, res) => {
  res.status(404).json({ message: '路径不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器错误' });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 服务启动成功: http://localhost:${PORT}`);
});

// 捕获异常
process.on('unhandledRejection', (err) => {
  console.error('未处理异常:', err);
});