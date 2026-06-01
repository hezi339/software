const fs = require('fs');
const path = require('path');

// ===================== 备份配置（适配你的项目） =====================
// 需要备份的SQLite数据库文件（和你的项目文件对应）
const DB_FILES = [
    'database.sqlite',
    'database.app.sqlite'
];
// 备份文件保存目录（自动创建，无需手动建文件夹）
const BACKUP_DIR = path.join(__dirname, 'backups');
// 时间戳（避免备份文件重名，格式：YYYY-MM-DD-HH-MM-SS）
const TIMESTAMP = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);

// ===================== 备份逻辑 =====================
try {
    // 1. 创建备份目录（不存在则自动创建）
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log('✅ 备份目录已创建：', BACKUP_DIR);
    }

    // 2. 循环备份每个数据库文件
    DB_FILES.forEach((dbFile) => {
        const dbPath = path.join(__dirname, dbFile);
        // 检查数据库文件是否存在
        if (!fs.existsSync(dbPath)) {
            console.warn(`⚠️  跳过不存在的数据库文件：${dbFile}`);
            return;
        }

        // 生成备份文件名：原文件名 + 时间戳（避免覆盖旧备份）
        const backupFileName = `${dbFile.replace('.sqlite', '')}-${TIMESTAMP}.sqlite`;
        const backupPath = path.join(BACKUP_DIR, backupFileName);

        // 3. 直接复制SQLite文件备份（SQLite无需导出，复制文件即可完整备份）
        fs.copyFileSync(dbPath, backupPath);
        console.log(`✅ 备份成功：${dbFile} → ${backupFileName}`);
    });

    console.log(`\n🎉 所有备份完成！备份文件保存在：${BACKUP_DIR}`);

} catch (err) {
    console.error('\n❌ 备份失败：', err.message);
    process.exit(1);
}