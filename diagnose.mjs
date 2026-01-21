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

console.log('\n========== 物料分配页面诊断 ==========\n');

try {
  // 1. 检查material_plans表
  console.log('[1] 检查物料计划表:');
  const [plans] = await connection.query('SELECT id, fileName FROM material_plans LIMIT 5');
  console.log(`   找到 ${plans.length} 个计划:`);
  plans.forEach(p => console.log(`   - 计划${p.id}: ${p.fileName}`));

  // 2. 检查material_items表
  console.log('\n[2] 检查物料项表:');
  const [allItems] = await connection.query('SELECT COUNT(*) as count FROM material_items');
  console.log(`   总共有 ${allItems[0].count} 个物料项`);
  
  const [items1] = await connection.query('SELECT id, planId, materialCode, materialName FROM material_items WHERE planId = 1');
  console.log(`   计划1中有 ${items1.length} 个物料:`);
  items1.forEach(item => console.log(`   - ID${item.id}: ${item.materialCode} (${item.materialName})`));

  // 3. 检查material_supplier_mappings表
  console.log('\n[3] 检查物料供应商映射表:');
  const [allMappings] = await connection.query('SELECT COUNT(*) as count FROM material_supplier_mappings');
  console.log(`   总共有 ${allMappings[0].count} 条映射`);
  
  const [mappings] = await connection.query(`
    SELECT 
      materialCode,
      COUNT(DISTINCT supplierId) as supplierCount,
      GROUP_CONCAT(DISTINCT supplierId) as supplierIds,
      GROUP_CONCAT(sharePercentage) as percentages
    FROM material_supplier_mappings
    GROUP BY materialCode
  `);
  console.log(`   物料映射详情:`);
  mappings.forEach(m => {
    console.log(`   - ${m.materialCode}: ${m.supplierCount}个供应商 (IDs: ${m.supplierIds}, 份额: ${m.percentages})`);
  });

  // 4. 检查多供应商物料
  console.log('\n[4] 检查多供应商物料:');
  const [multiSupplier] = await connection.query(`
    SELECT 
      materialCode,
      COUNT(DISTINCT supplierId) as supplierCount
    FROM material_supplier_mappings
    GROUP BY materialCode
    HAVING COUNT(DISTINCT supplierId) > 1
  `);
  console.log(`   找到 ${multiSupplier.length} 个多供应商物料:`);
  multiSupplier.forEach(m => console.log(`   - ${m.materialCode}: ${m.supplierCount}个供应商`));

  // 5. 检查计划1中的多供应商物料
  console.log('\n[5] 检查计划1中的多供应商物料:');
  const [plan1MultiSupplier] = await connection.query(`
    SELECT DISTINCT
      mi.materialCode,
      mi.materialName,
      COUNT(DISTINCT msm.supplierId) as supplierCount,
      GROUP_CONCAT(DISTINCT msm.supplierId) as supplierIds
    FROM material_items mi
    LEFT JOIN material_supplier_mappings msm ON mi.materialCode = msm.materialCode
    WHERE mi.planId = 1
    GROUP BY mi.materialCode, mi.materialName
    HAVING COUNT(DISTINCT msm.supplierId) > 1
  `);
  console.log(`   找到 ${plan1MultiSupplier.length} 个多供应商物料:`);
  plan1MultiSupplier.forEach(m => {
    console.log(`   - ${m.materialCode} (${m.materialName}): ${m.supplierCount}个供应商 (IDs: ${m.supplierIds})`);
  });

  // 6. 检查当前用户
  console.log('\n[6] 检查当前用户:');
  const [users] = await connection.query('SELECT id, openId FROM users LIMIT 1');
  if (users.length > 0) {
    console.log(`   当前用户: ID=${users[0].id}, OpenID=${users[0].openId}`);
  }

  // 7. 检查materialSupplierMappings中的userId
  console.log('\n[7] 检查materialSupplierMappings中的userId:');
  const [userIds] = await connection.query(`
    SELECT DISTINCT userId, COUNT(*) as count
    FROM material_supplier_mappings
    GROUP BY userId
  `);
  console.log(`   映射表中的userId分布:`);
  userIds.forEach(u => console.log(`   - userId=${u.userId}: ${u.count}条记录`));

  // 8. 检查suppliers表
  console.log('\n[8] 检查供应商表:');
  const [suppliers] = await connection.query('SELECT id, supplierName FROM suppliers LIMIT 5');
  if (suppliers.length > 0) {
    console.log(`   找到 ${suppliers.length} 个供应商:`);
    suppliers.forEach(s => console.log(`   - ID${s.id}: ${s.supplierName}`));
  } else {
    console.log('   没有供应商数据');
  }

  console.log('\n========== 诊断完成 ==========\n');

} catch (error) {
  console.error('诊断错误:', error.message);
  console.error(error);
} finally {
  await connection.end();
}
