const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// 生成月度健康报表PDF（极简版 无需字体配置）
exports.generateHealthReportPDF = async (petId, reportMonth, trendData) => {
    return new Promise((resolve, reject) => {
        // 基础参数校验
        if (!petId || !reportMonth) {
            return reject(new Error('宠物ID和报表月份不能为空'));
        }

        try {
            // 定义PDF存储目录（自动创建，无需手动建文件夹）
            const pdfDir = path.join(__dirname, '../uploads/reports');
            fs.mkdirSync(pdfDir, { recursive: true });

            // 文件名和路径
            const fileName = `pet_${petId}_${reportMonth}.pdf`;
            const filePath = path.join(pdfDir, fileName);

            // 创建PDF（最简配置）
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // ========== PDF内容（极简排版） ==========
            doc.fontSize(18).text(`Pet Health Report ${reportMonth}`, { align: 'center' });
            doc.moveDown();

            doc.fontSize(12).text(`Pet ID: ${petId}`);
            doc.text(`Create Time: ${moment().format('YYYY-MM-DD HH:mm')}`);
            doc.moveDown();

            doc.text('Health Trend Data:');
            const data = trendData ? JSON.stringify(trendData, null, 2) : 'No data';
            doc.text(data);
            // ========================================

            doc.end();

            // 完成回调
            stream.on('finish', () => {
                resolve(`/uploads/reports/${fileName}`);
            });

            // 错误捕获
            stream.on('error', (err) => {
                reject(new Error('PDF生成失败：' + err.message));
            });

        } catch (err) {
            reject(new Error('生成报表失败：' + err.message));
        }
    });
};