import mysql from 'mysql2/promise';

async function testPerformanceStats() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    // 获取物料计划ID
    const [plans] = await connection.query(
      "SELECT id FROM material_plans WHERE fileName LIKE '%1月5日-2月13日%' LIMIT 1"
    );
    
    const planId = (plans as any[])[0].id;
    console.log('Plan ID:', planId);

    // 获取所有物料明细
    const [items] = await connection.query(
      'SELECT materialCode, materialName, dailySchedule FROM material_items WHERE planId = ? LIMIT 5',
      [planId]
    );

    console.log('\n前5个物料明细:');
    for (const item of items as any[]) {
      console.log(`\n物料: ${item.materialCode} - ${item.materialName}`);
      const schedule = typeof item.dailySchedule === 'string' ? JSON.parse(item.dailySchedule) : item.dailySchedule;
      console.log('计划日期:', Object.keys(schedule).slice(0, 3).join(', '), '...');
      
      // 查询该物料的实际到货记录
      const [receipts] = await connection.query(
        'SELECT businessDate, supplierName, actualQuantity FROM actual_receipts WHERE materialCode = ? LIMIT 3',
        [item.materialCode]
      );
      
      console.log('实际到货记录:', (receipts as any[]).length, '条');
      (receipts as any[]).forEach((r: any) => {
        console.log(`  - ${r.businessDate}: ${r.supplierName}, ${r.actualQuantity}`);
      });
    }

  } finally {
    await connection.end();
  }
}

testPerformanceStats().then(() => {
  console.log('\n✅ 测试完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
