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

console.log('\n========== 真实数据分析 ==========\n');

try {
  // 1. 查询所有物料计划
  console.log('[1] 所有物料计划:');
  const [plans] = await connection.query(`
    SELECT id, fileName, planStartDate, planEndDate, uploadedAt
    FROM material_plans
    ORDER BY id DESC
    LIMIT 10
  `);
  console.log(`   找到 ${plans.length} 个计划:`);
  plans.forEach(p => {
    console.log(`   - 计划${p.id}: ${p.fileName} (${p.planStartDate} ~ ${p.planEndDate})`);
  });

  // 2. 对每个计划，查询物料数量
  console.log('\n[2] 每个计划的物料数量:');
  for (const plan of plans.slice(0, 3)) {
    const [items] = await connection.query(
      'SELECT COUNT(*) as count FROM material_items WHERE planId = ?',
      [plan.id]
    );
    console.log(`   - 计划${plan.id}: ${items[0].count}个物料`);
  }

  // 3. 查询采购订单表结构
  console.log('\n[3] 查询采购订单相关表:');
  const [tables] = await connection.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME LIKE '%purchase%' OR TABLE_NAME LIKE '%order%'
  `);
  console.log(`   找到 ${tables.length} 个相关表:`);
  tables.forEach(t => console.log(`   - ${t.TABLE_NAME}`));

  // 4. 查询采购订单数据
  if (tables.length > 0) {
    console.log('\n[4] 采购订单数据:');
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`   - ${tableName}: ${count[0].count}条记录`);
      
      // 显示前3条记录的列名
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      const columnNames = columns.map(c => c.Field).join(', ');
      console.log(`     列: ${columnNames.substring(0, 100)}...`);
    }
  }

  // 5. 查询物料与供应商的关系
  console.log('\n[5] 物料与供应商的关系:');
  const [relationship] = await connection.query(`
    SELECT 
      mi.planId,
      COUNT(DISTINCT mi.materialCode) as materialCount,
      COUNT(DISTINCT msm.supplierId) as supplierCount,
      COUNT(DISTINCT msm.materialCode) as mappedMaterialCount
    FROM material_items mi
    LEFT JOIN material_supplier_mappings msm ON mi.materialCode = msm.materialCode
    GROUP BY mi.planId
    ORDER BY mi.planId DESC
    LIMIT 5
  `);
  console.log(`   计划与物料/供应商的关系:`);
  relationship.forEach(r => {
    console.log(`   - 计划${r.planId}: ${r.materialCount}个物料, ${r.mappedMaterialCount}个有映射, ${r.supplierCount}个供应商`);
  });

  // 6. 查询有多个供应商的物料
  console.log('\n[6] 有多个供应商的物料:');
  const [multiSupplier] = await connection.query(`
    SELECT 
      mi.planId,
      mi.materialCode,
      mi.materialName,
      COUNT(DISTINCT msm.supplierId) as supplierCount,
      GROUP_CONCAT(DISTINCT msm.supplierId) as supplierIds
    FROM material_items mi
    LEFT JOIN material_supplier_mappings msm ON mi.materialCode = msm.materialCode
    GROUP BY mi.planId, mi.materialCode, mi.materialName
    HAVING COUNT(DISTINCT msm.supplierId) > 1
    ORDER BY mi.planId DESC
    LIMIT 20
  `);
  console.log(`   找到 ${multiSupplier.length} 个多供应商物料:`);
  multiSupplier.forEach(m => {
    console.log(`   - 计划${m.planId}: ${m.materialCode} (${m.materialName}) - ${m.supplierCount}个供应商 (${m.supplierIds})`);
  });

  // 7. 如果没有多供应商物料，查询原因
  if (multiSupplier.length === 0) {
    console.log('\n[7] 分析为什么没有多供应商物料:');
    
    // 检查是否有任何供应商映射
    const [anyMapping] = await connection.query('SELECT COUNT(*) as count FROM material_supplier_mappings');
    console.log(`   - materialSupplierMappings表总记录数: ${anyMapping[0].count}`);
    
    if (anyMapping[0].count === 0) {
      console.log('   ⚠️  materialSupplierMappings表为空！');
      console.log('   可能的原因：');
      console.log('   1. 系统中没有配置供应商映射');
      console.log('   2. 供应商映射数据存储在其他表中');
      console.log('   3. 需要从采购订单或其他来源导入供应商映射');
    } else {
      // 检查是否有物料没有映射
      const [unmappedMaterials] = await connection.query(`
        SELECT COUNT(DISTINCT mi.materialCode) as count
        FROM material_items mi
        WHERE mi.materialCode NOT IN (SELECT DISTINCT materialCode FROM material_supplier_mappings)
      `);
      console.log(`   - 没有映射的物料数: ${unmappedMaterials[0].count}`);
      
      // 检查是否所有物料都只有一个供应商
      const [singleSupplier] = await connection.query(`
        SELECT COUNT(DISTINCT materialCode) as count
        FROM material_supplier_mappings
        GROUP BY materialCode
        HAVING COUNT(DISTINCT supplierId) = 1
      `);
      console.log(`   - 只有一个供应商的物料数: ${singleSupplier.length}`);
    }
  }

  console.log('\n========== 分析完成 ==========\n');

} catch (error) {
  console.error('分析错误:', error.message);
  console.error(error);
} finally {
  await connection.end();
}
