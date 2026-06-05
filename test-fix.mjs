import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testFix() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'localhost',
    user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
    password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
    database: process.env.DATABASE_URL?.split('/').pop() || 'test',
  });

  try {
    // 获取最新的供应商确认记录
    const [confirmations] = await connection.execute(
      'SELECT id, token, planId, supplierId, dailySchedule FROM supplier_confirmations ORDER BY id DESC LIMIT 1'
    );

    if (confirmations.length === 0) {
      console.log('没有找到供应商确认记录');
      return;
    }

    const confirmation = confirmations[0];
    console.log('\n=== 供应商确认记录 ===');
    console.log('ID:', confirmation.id);
    console.log('Token:', confirmation.token);
    console.log('计划ID:', confirmation.planId);
    console.log('供应商ID:', confirmation.supplierId);
    
    // 解析dailySchedule
    let dailySchedule = {};
    if (confirmation.dailySchedule) {
      try {
        dailySchedule = JSON.parse(confirmation.dailySchedule);
      } catch (e) {
        console.log('dailySchedule解析失败:', e.message);
      }
    }
    
    console.log('\n=== 日期维度来货数量 ===');
    const sortedDates = Object.keys(dailySchedule).sort();
    for (const date of sortedDates) {
      console.log(`${date}: ${dailySchedule[date]}`);
    }
    
    // 获取该计划的所有物料
    const [materials] = await connection.execute(
      'SELECT materialCode, materialName, dailySchedule FROM material_items WHERE planId = ?',
      [confirmation.planId]
    );
    
    console.log('\n=== 物料A1300038的原始来货数量 ===');
    const material = materials.find(m => m.materialCode === 'A1300038');
    if (material) {
      let originalSchedule = {};
      if (material.dailySchedule) {
        try {
          originalSchedule = JSON.parse(material.dailySchedule);
        } catch (e) {
          console.log('物料dailySchedule解析失败:', e.message);
        }
      }
      
      const sortedDates = Object.keys(originalSchedule).sort();
      for (const date of sortedDates.slice(0, 5)) {
        console.log(`${date}: ${originalSchedule[date]}`);
      }
    }
    
    // 获取该供应商的份额配置
    const [mappings] = await connection.execute(
      'SELECT materialCode, sharePercentage FROM material_supplier_mappings WHERE supplierId = ? AND materialCode = "A1300038"',
      [confirmation.supplierId]
    );
    
    console.log('\n=== 供应商份额配置 ===');
    if (mappings.length > 0) {
      console.log('物料代码:', mappings[0].materialCode);
      console.log('份额百分比:', mappings[0].sharePercentage);
    }
    
  } finally {
    await connection.end();
  }
}

testFix().catch(console.error);
