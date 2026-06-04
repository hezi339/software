require('./loadEnv');

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// 检查并添加字段
function addColumnIfNotExists(table, column, type, defaultValue = null) {
    return new Promise((resolve) => {
        db.get(`PRAGMA table_info(${table})`, (err, rows) => {
            if (err) {
                resolve();
                return;
            }
            
            // 检查字段是否存在
            db.all(`PRAGMA table_info(${table})`, (err, columns) => {
                const exists = columns.some(col => col.name === column);
                
                if (!exists) {
                    let sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`;
                    if (defaultValue !== null) {
                        sql += ` DEFAULT ${defaultValue}`;
                    }
                    db.run(sql, (err) => {
                        if (err) {
                            console.error(`Failed to add ${column} to ${table}:`, err.message);
                        } else {
                            console.log(`Added ${column} to ${table}`);
                        }
                        resolve();
                    });
                } else {
                    console.log(`${column} already exists in ${table}`);
                    resolve();
                }
            });
        });
    });
}

async function migrate() {
    // 为 diet_records 添加新字段
    await addColumnIfNotExists('diet_records', 'time', 'TEXT', "''");
    await addColumnIfNotExists('diet_records', 'food_brand', 'TEXT');
    await addColumnIfNotExists('diet_records', 'food_product', 'TEXT');
    await addColumnIfNotExists('diet_records', 'feeding_suggestion', 'TEXT');
    await addColumnIfNotExists('diet_records', 'feeding_status', 'TEXT');

    // 为 behavior_records 添加新字段
    await addColumnIfNotExists('behavior_records', 'potty_character', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'potty_color', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'potty_location', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'water_ml', 'INTEGER', 0);
    await addColumnIfNotExists('behavior_records', 'water_frequency', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'water_type', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'activity_level', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'appetite', 'TEXT');
    await addColumnIfNotExists('behavior_records', 'symptoms', 'TEXT');

    console.log('\nMigration completed successfully');
    db.close();
}

migrate();
