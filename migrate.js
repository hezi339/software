require('./loadEnv');

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// 创建所有表（如果不存在）
function createTables() {
    return new Promise((resolve, reject) => {
        // 1. 创建饮食记录表 diet_records 基础结构
        const createDietRecordsSql = `
            CREATE TABLE IF NOT EXISTS diet_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 2. 创建行为记录表 behavior_records 基础结构
        const createBehaviorRecordsSql = `
            CREATE TABLE IF NOT EXISTS behavior_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 执行创建 diet_records 表
        db.run(createDietRecordsSql, (err) => {
            if (err) {
                reject(`创建 diet_records 表失败: ${err.message}`);
                return;
            }
            console.log('diet_records 表创建成功（或已存在）');

            // 执行创建 behavior_records 表
            db.run(createBehaviorRecordsSql, (err) => {
                if (err) {
                    reject(`创建 behavior_records 表失败: ${err.message}`);
                    return;
                }
                console.log('behavior_records 表创建成功（或已存在）');
                resolve();
            });
        });
    });
}

// 检查并添加字段（保留原有逻辑）
function addColumnIfNotExists(table, column, type, defaultValue = null) {
    return new Promise((resolve) => {
        // 检查字段是否存在
        db.all(`PRAGMA table_info(${table})`, (err, columns) => {
            if (err) {
                console.error(`查询 ${table} 字段失败: ${err.message}`);
                resolve();
                return;
            }

            const exists = columns.some(col => col.name === column);
            if (!exists) {
                let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
                if (defaultValue !== null) {
                    // 处理字符串类型默认值的引号
                    const value = typeof defaultValue === 'string' ? `'${defaultValue}'` : defaultValue;
                    sql += ` DEFAULT ${value}`;
                }

                db.run(sql, (err) => {
                    if (err) {
                        console.error(`为 ${table} 添加 ${column} 字段失败: ${err.message}`);
                    } else {
                        console.log(`为 ${table} 成功添加 ${column} 字段`);
                    }
                    resolve();
                });
            } else {
                console.log(`${table} 表中 ${column} 字段已存在`);
                resolve();
            }
        });
    });
}

async function migrate() {
    try {
        // 第一步：创建所有基础表
        await createTables();

        // 第二步：为 diet_records 添加新字段
        await addColumnIfNotExists('diet_records', 'time', 'TEXT', "''");
        await addColumnIfNotExists('diet_records', 'food_brand', 'TEXT');
        await addColumnIfNotExists('diet_records', 'food_product', 'TEXT');
        await addColumnIfNotExists('diet_records', 'feeding_suggestion', 'TEXT');
        await addColumnIfNotExists('diet_records', 'feeding_status', 'TEXT');

        // 第三步：为 behavior_records 添加新字段
        await addColumnIfNotExists('behavior_records', 'potty_character', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'potty_color', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'potty_location', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'water_ml', 'INTEGER', 0);
        await addColumnIfNotExists('behavior_records', 'water_frequency', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'water_type', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'activity_level', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'appetite', 'TEXT');
        await addColumnIfNotExists('behavior_records', 'symptoms', 'TEXT');

        console.log('\n✅ 数据库迁移完成（表创建+字段添加）');
    } catch (error) {
        console.error('\n❌ 数据库迁移失败:', error);
    } finally {
        db.close((err) => {
            if (err) console.error('关闭数据库连接失败:', err.message);
        });
    }
}

// 执行迁移
migrate();