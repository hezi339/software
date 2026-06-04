const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库文件路径
const dbPath = path.join(__dirname, 'database.app.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log(`成功连接到数据库: ${dbPath}`);
  }
});

// 启用外键约束
db.run('PRAGMA foreign_keys = ON');

// 序列化执行建表（保证顺序）
db.serialize(() => {
  // 1. 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('创建 users 表失败:', err.message);
  });

  // 为已存在的 users 表添加 email 字段（兼容旧数据库）
  db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 email 字段失败:', err.message);
  });
  db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 is_admin 字段失败:', err.message);
  });
  db.run(`ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 updated_at 字段失败:', err.message);
  });

  // 2. 宠物表
  db.run(`CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    breed TEXT,
    birthday TEXT,
    gender TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 pets 表失败:', err.message);
  });

  // 3. 饮食记录表
  db.run(`CREATE TABLE IF NOT EXISTS diet_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    food_name TEXT,
    amount TEXT,
    record_time TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 diet_records 表失败:', err.message);
  });

  // 4. 行为记录表
  db.run(`CREATE TABLE IF NOT EXISTS behavior_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    behavior_type TEXT,
    duration TEXT,
    record_time TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 behavior_records 表失败:', err.message);
  });

  // 5. 体重记录表
  db.run(`CREATE TABLE IF NOT EXISTS weight_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    weight REAL,
    record_time TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 weight_records 表失败:', err.message);
  });

  // 6. 疫苗记录表
  db.run(`CREATE TABLE IF NOT EXISTS vaccine_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    vaccine_name TEXT,
    vaccine_date TEXT,
    next_date TEXT,
    hospital TEXT,
    completed INTEGER DEFAULT 0,
    on_time INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 vaccine_records 表失败:', err.message);
  });

  // 为已存在的 vaccine_records 表添加新字段（兼容旧数据库）
  db.run(`ALTER TABLE vaccine_records ADD COLUMN hospital TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 hospital 字段失败:', err.message);
  });
  db.run(`ALTER TABLE vaccine_records ADD COLUMN completed INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 completed 字段失败:', err.message);
  });
  db.run(`ALTER TABLE vaccine_records ADD COLUMN on_time INTEGER DEFAULT 1`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 on_time 字段失败:', err.message);
  });
  db.run(`ALTER TABLE vaccine_records ADD COLUMN notes TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 notes 字段失败:', err.message);
  });
  db.run(`ALTER TABLE vaccine_records ADD COLUMN updated_at TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) console.error('添加 updated_at 字段失败:', err.message);
  });

  // 7. 医疗记录表
  db.run(`CREATE TABLE IF NOT EXISTS medical_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    symptom TEXT,
    diagnosis TEXT,
    treatment TEXT,
    treat_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 medical_records 表失败:', err.message);
  });

  // 8. AI分析记录表
  db.run(`CREATE TABLE IF NOT EXISTS ai_analysis_records (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL,
    analysis_result TEXT,
    advice TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
  )`, (err) => {
    if (err) console.error('创建 ai_analysis_records 表失败:', err.message);
  });

  // 9. 操作日志表
  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    operation TEXT,
    module TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('创建 operation_logs 表失败:', err.message);
  });

  // 10. 系统配置表
  db.run(`CREATE TABLE IF NOT EXISTS system_configs (
    id TEXT PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('创建 system_configs 表失败:', err.message);
  });

  // 11. 救助动物表
  db.run(`CREATE TABLE IF NOT EXISTS rescue_animals (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    description TEXT,
    status TEXT DEFAULT '待救助',
    review_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) console.error('创建 rescue_animals 表失败:', err.message);
  });
});

// 验证数据库
db.get('SELECT 1 AS validate', (err) => {
  if (!err) console.log('数据库验证成功，所有表初始化完成');
});

module.exports = db;