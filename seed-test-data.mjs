import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

// 解析DATABASE_URL
const dbUrl = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: dbUrl.hostname,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: {},
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0,
});

try {
  console.log('开始插入测试数据...');

  // 1. 获取用户ID
  const [users] = await connection.query('SELECT id FROM users LIMIT 1');
  if (users.length === 0) {
    console.error('错误：数据库中没有用户');
    process.exit(1);
  }
  const userId = users[0].id;
  console.log(`使用用户ID: ${userId}`);

  // 2. 获取供应商ID
  const [suppliers] = await connection.query('SELECT id FROM suppliers WHERE userId = ? LIMIT 3', [userId]);
  if (suppliers.length < 2) {
    console.error('错误：该用户没有足够的供应商');
    process.exit(1);
  }
  const supplierIds = suppliers.map(s => s.id);
  console.log(`使用供应商ID: ${supplierIds.join(', ')}`);

  // 3. 清空现有的物料供应商映射（仅用于测试）
  await connection.query('DELETE FROM material_supplier_mappings WHERE userId = ?', [userId]);
  console.log('已清空现有的物料供应商映射');

  // 4. 为MAT001创建两个供应商映射（60%和40%）
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
    [userId, 'MAT001', supplierIds[0], 60, 1]
  );
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
    [userId, 'MAT001', supplierIds[1], 40, 2]
  );
  console.log('已为MAT001创建两个供应商映射（60%和40%）');

  // 5. 为MAT002创建两个供应商映射（50%和50%）
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
    [userId, 'MAT002', supplierIds[0], 50, 1]
  );
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
    [userId, 'MAT002', supplierIds[1], 50, 2]
  );
  console.log('已为MAT002创建两个供应商映射（50%和50%）');

  // 6. 为MAT003创建三个供应商映射（40%、35%、25%）
  if (supplierIds.length >= 3) {
    await connection.query(
      'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
      [userId, 'MAT003', supplierIds[0], 40, 1]
    );
    await connection.query(
      'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
      [userId, 'MAT003', supplierIds[1], 35, 2]
    );
    await connection.query(
      'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage, priority) VALUES (?, ?, ?, ?, ?)',
      [userId, 'MAT003', supplierIds[2], 25, 3]
    );
    console.log('已为MAT003创建三个供应商映射（40%、35%、25%）');
  }

  // 7. 验证插入的数据
  const [mappings] = await connection.query(
    'SELECT materialCode, supplierId, sharePercentage FROM material_supplier_mappings WHERE userId = ? ORDER BY materialCode, priority',
    [userId]
  );
  console.log('\n已插入的物料供应商映射:');
  console.table(mappings);

  console.log('\n✅ 测试数据插入成功！');
} catch (error) {
  console.error('错误:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
