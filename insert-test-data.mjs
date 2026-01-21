#!/usr/bin/env node
import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const dbUrl = new URL(process.env.DATABASE_URL);
const connection = await mysql.createConnection({
  host: dbUrl.hostname,
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1),
  ssl: {},
});

console.log('\n========== 为计划1插入多供应商映射 ==========\n');

try {
  // 获取当前用户ID
  const [users] = await connection.query('SELECT id FROM users LIMIT 1');
  const userId = users[0].id;
  console.log(`当前用户ID: ${userId}`);

  // 获取供应商ID
  const [suppliers] = await connection.query('SELECT id FROM suppliers LIMIT 5');
  const supplierIds = suppliers.map(s => s.id);
  console.log(`可用供应商ID: ${supplierIds.join(', ')}`);

  // 为MAT001插入2个供应商
  console.log('\n插入MAT001的供应商映射:');
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT001', supplierIds[0], 60]
  );
  console.log(`  - 供应商${supplierIds[0]}: 60%`);
  
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT001', supplierIds[1], 40]
  );
  console.log(`  - 供应商${supplierIds[1]}: 40%`);

  // 为MAT002插入2个供应商
  console.log('\n插入MAT002的供应商映射:');
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT002', supplierIds[1], 50]
  );
  console.log(`  - 供应商${supplierIds[1]}: 50%`);
  
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT002', supplierIds[2], 50]
  );
  console.log(`  - 供应商${supplierIds[2]}: 50%`);

  // 为MAT003插入3个供应商
  console.log('\n插入MAT003的供应商映射:');
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT003', supplierIds[2], 40]
  );
  console.log(`  - 供应商${supplierIds[2]}: 40%`);
  
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT003', supplierIds[3], 35]
  );
  console.log(`  - 供应商${supplierIds[3]}: 35%`);
  
  await connection.query(
    'INSERT INTO material_supplier_mappings (userId, materialCode, supplierId, sharePercentage) VALUES (?, ?, ?, ?)',
    [userId, 'MAT003', supplierIds[4], 25]
  );
  console.log(`  - 供应商${supplierIds[4]}: 25%`);

  // 验证插入结果
  console.log('\n验证插入结果:');
  const [result] = await connection.query(`
    SELECT 
      materialCode,
      COUNT(DISTINCT supplierId) as supplierCount,
      SUM(sharePercentage) as totalShare
    FROM material_supplier_mappings
    WHERE materialCode IN ('MAT001', 'MAT002', 'MAT003')
    GROUP BY materialCode
  `);
  
  result.forEach(r => {
    console.log(`  - ${r.materialCode}: ${r.supplierCount}个供应商, 总份额${r.totalShare}%`);
  });

  console.log('\n========== 插入完成 ==========\n');

} catch (error) {
  console.error('插入错误:', error.message);
  console.error(error);
} finally {
  await connection.end();
}
