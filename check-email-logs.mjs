import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkEmailLogs() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'localhost',
    user: process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || 'root',
    password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
    database: process.env.DATABASE_URL?.split('/').pop() || 'test',
  });

  try {
    // 查询邮件发送记录统计
    console.log('\n=== 邮件发送记录统计 ===');
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT planId) as plans,
        COUNT(DISTINCT supplierId) as suppliers
      FROM email_send_logs
    `);
    
    console.log('总发送记录数:', stats[0].total_records);
    console.log('计划数:', stats[0].plans);
    console.log('供应商数:', stats[0].suppliers);
    
    // 查询最近的邮件发送记录
    console.log('\n=== 最近的邮件发送记录（前5条） ===');
    const [recent] = await connection.execute(`
      SELECT id, planId, supplierId, recipientEmail, status, sentAt
      FROM email_send_logs
      ORDER BY sentAt DESC
      LIMIT 5
    `);
    
    for (const log of recent) {
      console.log(`ID: ${log.id}, 计划: ${log.planId}, 供应商: ${log.supplierId}, 邮箱: ${log.recipientEmail}, 状态: ${log.status}, 发送时间: ${log.sentAt}`);
    }
    
    // 查询按计划分组的统计
    console.log('\n=== 按计划分组的邮件发送统计 ===');
    const [byPlan] = await connection.execute(`
      SELECT 
        planId,
        COUNT(*) as count,
        COUNT(DISTINCT supplierId) as suppliers
      FROM email_send_logs
      GROUP BY planId
    `);
    
    for (const row of byPlan) {
      console.log(`计划 ${row.planId}: ${row.count} 条记录, ${row.suppliers} 个供应商`);
    }
    
    // 查询供应商确认记录
    console.log('\n=== 供应商确认记录统计 ===');
    const [confirmStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT planId) as plans,
        COUNT(DISTINCT supplierId) as suppliers
      FROM supplier_confirmations
    `);
    
    console.log('总确认记录数:', confirmStats[0].total_records);
    console.log('计划数:', confirmStats[0].plans);
    console.log('供应商数:', confirmStats[0].suppliers);
    
    // 比较邮件发送记录和确认记录
    console.log('\n=== 邮件发送 vs 供应商确认对比 ===');
    console.log(`邮件发送记录: ${stats[0].total_records} 条`);
    console.log(`供应商确认记录: ${confirmStats[0].total_records} 条`);
    console.log(`差异: ${stats[0].total_records - confirmStats[0].total_records} 条`);
    
  } finally {
    await connection.end();
  }
}

checkEmailLogs().catch(console.error);
