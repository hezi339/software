require('./loadEnv');

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const configuredDbPath = process.env.DB_PATH;
const dbPath = configuredDbPath
  ? (path.isAbsolute(configuredDbPath)
      ? configuredDbPath
      : path.join(__dirname, configuredDbPath))
  : path.join(__dirname, 'database.app.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Some Windows desktop folders reject SQLite's default journal writes.
  // Using an in-memory journal keeps the local demo app stable in this workspace.
  db.exec('PRAGMA journal_mode=MEMORY; PRAGMA synchronous=NORMAL; PRAGMA temp_store=MEMORY;');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      breed TEXT,
      pet_type TEXT DEFAULT 'cat',
      birth_date TEXT,
      age TEXT,
      gender TEXT,
      weight REAL,
      growth_stage TEXT,
      sterilized BOOLEAN DEFAULT 0,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS diet_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      food_type TEXT NOT NULL,
      food_brand TEXT,
      food_product TEXT,
      grams INTEGER NOT NULL,
      preference INTEGER DEFAULT 3,
      notes TEXT,
      feeding_suggestion TEXT,
      feeding_status TEXT,
      supplement_name TEXT,
      supplement_dosage TEXT,
      supplement_timing TEXT,
      supplement_frequency TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  // 尝试为已存在的表添加营养品字段（如果列已存在会失败，但不影响程序运行）
  db.run("ALTER TABLE diet_records ADD COLUMN supplement_name TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding supplement_name column:', err.message);
  });
  db.run("ALTER TABLE diet_records ADD COLUMN supplement_dosage TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding supplement_dosage column:', err.message);
  });
  db.run("ALTER TABLE diet_records ADD COLUMN supplement_timing TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding supplement_timing column:', err.message);
  });
  db.run("ALTER TABLE diet_records ADD COLUMN supplement_frequency TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding supplement_frequency column:', err.message);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS behavior_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      date TEXT NOT NULL,
      potty_count INTEGER DEFAULT 0,
      potty_character TEXT,
      potty_color TEXT,
      potty_location TEXT,
      water_ml INTEGER DEFAULT 0,
      water_frequency TEXT,
      water_type TEXT,
      activity_level TEXT,
      appetite TEXT,
      mood TEXT,
      symptoms TEXT,
      notes TEXT,
      in_heat BOOLEAN DEFAULT 0,
      heat_start_date TEXT,
      heat_end_date TEXT,
      heat_severity TEXT,
      heat_symptoms TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  // 尝试为已存在的表添加发情期字段
  db.run("ALTER TABLE behavior_records ADD COLUMN in_heat BOOLEAN DEFAULT 0", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding in_heat column:', err.message);
  });
  db.run("ALTER TABLE behavior_records ADD COLUMN heat_start_date TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding heat_start_date column:', err.message);
  });
  db.run("ALTER TABLE behavior_records ADD COLUMN heat_end_date TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding heat_end_date column:', err.message);
  });
  db.run("ALTER TABLE behavior_records ADD COLUMN heat_severity TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding heat_severity column:', err.message);
  });
  db.run("ALTER TABLE behavior_records ADD COLUMN heat_symptoms TEXT", (err) => {
    if (err && err.code !== 'SQLITE_ERROR') console.log('Adding heat_symptoms column:', err.message);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS weight_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      date TEXT NOT NULL,
      weight REAL NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vaccine_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      vaccine_name TEXT NOT NULL,
      vaccine_date TEXT NOT NULL,
      next_date TEXT,
      hospital TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      hospital TEXT,
      diagnosis TEXT,
      medication TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_analysis_records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      analysis_type TEXT NOT NULL,
      image_name TEXT,
      image_data TEXT NOT NULL,
      notes TEXT,
      analysis_date TEXT NOT NULL,
      summary TEXT,
      risk_level TEXT,
      confidence REAL,
      abnormal_items TEXT,
      health_advice TEXT,
      nutrition_focus TEXT,
      metrics TEXT,
      tags TEXT,
      service_source TEXT,
      raw_result TEXT,
      disclaimer TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pet_id) REFERENCES pets(id)
    )
  `);
});

module.exports = db;
