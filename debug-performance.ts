import mysql from 'mysql2/promise';

async function debugPerformance() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    // 1. 获取物料计划
    const [plans] = await connection.query(
      "SELECT * FROM material_plans WHERE fileName LIKE '%1月5日-2月13日%' LIMIT 1"
    );

    if (!Array.isArray(plans) || plans.length === 0) {
      console.log('❌ 未找到物料计划');
      return;
    }

    const plan = plans[0] as any;
    console.log('✅ 找到物料计划:', plan.id);

    // 2. 获取A1502484的物料明细
    const [items] = await connection.query(
      'SELECT * FROM material_items WHERE planId = ? AND materialCode = ?',
      [plan.id, 'A1502484']
    );

    if (!Array.isArray(items) || items.length === 0) {
      console.log('❌ 未找到A1502484的物料明细');
      return;
    }

    const item = items[0] as any;
    console.log('✅ 找到物料明细:', item.materialCode);
    console.log('dailySchedule (raw):', item.dailySchedule);
    
    const dailySchedule = typeof item.dailySchedule === 'string' 
      ? JSON.parse(item.dailySchedule) 
      : item.dailySchedule;
    
    console.log('dailySchedule (parsed):', dailySchedule);
    console.log('dailySchedule keys:', Object.keys(dailySchedule));

    // 3. 获取A1502484的实际到货记录
    const [receipts] = await connection.query(
      'SELECT * FROM actual_receipts WHERE materialCode = ? ORDER BY businessDate',
      ['A1502484']
    );

    if (!Array.isArray(receipts)) {
      console.log('❌ 未找到实际到货记录');
      return;
    }

    console.log('✅ 找到实际到货记录:', receipts.length, '条');
    receipts.forEach((r: any) => {
      console.log(`  - 日期: ${r.businessDate}, 供应商: ${r.supplierName}, 数量: ${r.actualQuantity}`);
    });

    // 4. 测试日期比较逻辑
    for (const receipt of receipts as any[]) {
      const actualDate = receipt.businessDate;
      console.log(`\n测试到货记录: ${actualDate}`);
      
      const promisedDates = Object.keys(dailySchedule)
        .filter(d => d <= actualDate)
        .sort();
      
      console.log(`  - 小于等于${actualDate}的计划日期:`, promisedDates);
      
      if (promisedDates.length > 0) {
        const promisedDate = promisedDates[promisedDates.length - 1];
        console.log(`  - 最近的计划日期: ${promisedDate}`);
        console.log(`  - 实际日期 === 计划日期? ${actualDate === promisedDate}`);
        console.log(`  - 实际日期 > 计划日期? ${actualDate > promisedDate}`);
      } else {
        console.log(`  - ❌ 没有找到小于等于${actualDate}的计划日期`);
      }
    }
  } finally {
    await connection.end();
  }
}

debugPerformance().then(() => {
  console.log('\n✅ 调试完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 调试失败:', err);
  process.exit(1);
});
