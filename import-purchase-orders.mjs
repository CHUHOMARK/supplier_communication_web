import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析 DATABASE_URL
function parseDatabaseUrl(url) {
  const urlObj = new URL(url);
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port || '3306'),
    user: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1),
    ssl: true, // 总是使用SSL
  };
}

async function importPurchaseOrders() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 环境变量未设置');
    process.exit(1);
  }

  const dbConfig = parseDatabaseUrl(databaseUrl);
  dbConfig.ssl = { rejectUnauthorized: false }; // 禁用证书验证

  const connection = await mysql.createConnection(dbConfig);
  console.log('✅ 数据库连接成功');

  try {
    // 获取当前用户ID（假设是第一个用户）
    const [users] = await connection.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) {
      console.error('❌ 数据库中没有用户');
      process.exit(1);
    }
    const userId = users[0].id;
    console.log(`✅ 使用用户ID: ${userId}`);

    // 读取Excel文件
    const excelPath = path.join(__dirname, '../upload/PurchaseOrder20260117.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const worksheet = workbook.worksheets[0];

    console.log(`📊 开始导入采购订单数据...`);

    // 清空现有数据
    await connection.query('DELETE FROM purchase_orders WHERE userId = ?', [userId]);
    console.log('🗑️  已清空现有采购订单数据');

    // 准备插入数据
    const insertData = [];
    let rowCount = 0;

    worksheet.eachRow((row, rowNumber) => {
      // 跳过标题行（前2行）
      if (rowNumber <= 2) return;

      const values = row.values;
      if (!values || !values[4]) return; // 料号为空则跳过

      const businessDate = values[1]; // 业务日期
      const poNumber = values[2]; // 单据编号
      const supplierName = values[3]; // 供应商
      const materialCode = values[4]; // 料号
      const materialName = values[5]; // 料品名称
      const materialSpec = values[6]; // 料品规格
      const purchaseQuantity = parseInt(values[7]) || 0; // 采购数量
      const confirmedQuantity = parseInt(values[8]) || 0; // 确认数量
      const receivedQuantity = parseInt(values[9]) || 0; // 累计实收数量
      const undeliveredQuantity = parseInt(values[10]) || 0; // 未到货数量
      const requiredDeliveryDate = values[11]; // 要求交货日期
      const purchaseStaff = values[13]; // 采购业务员名称

      insertData.push([
        userId,
        businessDate,
        poNumber,
        supplierName,
        materialCode,
        materialName,
        materialSpec,
        purchaseQuantity,
        confirmedQuantity,
        receivedQuantity,
        undeliveredQuantity,
        requiredDeliveryDate,
        purchaseStaff,
      ]);

      rowCount++;
    });

    // 批量插入数据
    if (insertData.length > 0) {
      const sql = `
        INSERT INTO purchase_orders (
          userId, businessDate, poNumber, supplierName, materialCode,
          materialName, materialSpec, purchaseQuantity, confirmedQuantity,
          receivedQuantity, undeliveredQuantity, requiredDeliveryDate, purchaseStaff
        ) VALUES ?
      `;

      await connection.query(sql, [insertData]);
      console.log(`✅ 成功导入 ${insertData.length} 条采购订单记录`);
    }

    // 统计多供应商物料
    const [stats] = await connection.query(`
      SELECT 
        materialCode,
        COUNT(DISTINCT supplierName) as supplier_count,
        SUM(undeliveredQuantity) as total_undelivered
      FROM purchase_orders
      WHERE userId = ?
      GROUP BY materialCode
      HAVING supplier_count > 1
      ORDER BY total_undelivered DESC
    `, [userId]);

    console.log(`\n📈 多供应商物料统计:`);
    console.log(`总数: ${stats.length} 个物料`);
    console.log(`\n前10个物料（按未到货数量排序）:`);
    stats.slice(0, 10).forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.materialCode}: ${row.supplier_count}个供应商, 未到货总数=${row.total_undelivered}`);
    });

  } finally {
    await connection.end();
  }
}

importPurchaseOrders().catch(err => {
  console.error('❌ 导入失败:', err.message);
  process.exit(1);
});
