import mysql from 'mysql2/promise';

async function testAPI() {
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
      'SELECT COUNT(*) as count FROM material_items WHERE planId = ?',
      [planId]
    );
    console.log('Material items count:', (items as any[])[0].count);

    // 获取所有实际到货记录
    const [receipts] = await connection.query(
      'SELECT COUNT(*) as count FROM actual_receipts'
    );
    console.log('Actual receipts count:', (receipts as any[])[0].count);

    // 测试能匹配上的记录数
    const [matched] = await connection.query(`
      SELECT COUNT(*) as count
      FROM material_items mi
      INNER JOIN actual_receipts ar ON mi.materialCode = ar.materialCode
      WHERE mi.planId = ?
    `, [planId]);
    console.log('Matched records count:', (matched as any[])[0].count);

    // 获取所有供应商名称
    const [suppliers] = await connection.query(`
      SELECT DISTINCT supplierName
      FROM actual_receipts
      ORDER BY supplierName
    `);
    console.log('\n供应商列表:');
    (suppliers as any[]).forEach(s => console.log('  -', s.supplierName));

  } finally {
    await connection.end();
  }
}

testAPI().then(() => {
  console.log('\n✅ 测试完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
