import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/')[3] || 'test',
});

try {
  console.log('🔍 查询物料 A1300038 的原始来货数量');
  const [materials] = await connection.execute(
    'SELECT id, materialCode, dailySchedule FROM material_items WHERE materialCode = ?',
    ['A1300038']
  );
  
  if (materials.length === 0) {
    console.log('❌ 物料 A1300038 不存在');
    process.exit(1);
  }
  
  const material = materials[0];
  console.log(`\n📋 物料信息:`);
  console.log(`   ID: ${material.id}`);
  console.log(`   物料代码: ${material.materialCode}`);
  
  let dailySchedule = material.dailySchedule;
  if (typeof dailySchedule === 'string') {
    dailySchedule = JSON.parse(dailySchedule);
  }
  
  console.log(`\n📊 原始来货数量 (dailySchedule):`);
  const dates = Object.keys(dailySchedule).sort();
  for (const date of dates) {
    console.log(`   ${date}: ${dailySchedule[date]}`);
  }
  
  const totalQty = Object.values(dailySchedule).reduce((sum, qty) => sum + qty, 0);
  console.log(`   总计: ${totalQty}`);
  
  // 查询该物料的供应商份额配置
  console.log(`\n🏢 供应商份额配置:`);
  const [mappings] = await connection.execute(
    'SELECT id, supplierId, sharePercentage FROM material_supplier_mappings WHERE materialCode = ? ORDER BY supplierId',
    ['A1300038']
  );
  
  if (mappings.length === 0) {
    console.log('   该物料没有供应商映射');
    process.exit(0);
  }
  
  for (const mapping of mappings) {
    const [suppliers] = await connection.execute(
      'SELECT supplierName FROM suppliers WHERE id = ?',
      [mapping.supplierId]
    );
    
    const supplierName = suppliers.length > 0 ? suppliers[0].supplierName : '未知供应商';
    const sharePercentage = parseFloat(mapping.sharePercentage);
    
    console.log(`   供应商ID ${mapping.supplierId} (${supplierName}): ${sharePercentage}%`);
    
    // 计算该供应商应该分配的数量
    const allocatedSchedule = {};
    for (const date of dates) {
      allocatedSchedule[date] = Math.round(dailySchedule[date] * (sharePercentage / 100));
    }
    
    const allocatedTotal = Object.values(allocatedSchedule).reduce((sum, qty) => sum + qty, 0);
    console.log(`      应该分配的数量:`);
    for (const date of dates) {
      console.log(`        ${date}: ${allocatedSchedule[date]}`);
    }
    console.log(`        总计: ${allocatedTotal}`);
  }
  
} finally {
  await connection.end();
}
