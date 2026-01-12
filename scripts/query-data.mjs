import mysql from 'mysql2/promise';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  
  const connection = await mysql.createConnection(dbUrl);
  
  // 查询供应商确认记录
  console.log('\n========== 供应商确认记录 ==========\n');
  const [confirmations] = await connection.execute(`
    SELECT 
      id,
      confirmToken,
      status,
      supplierNotes,
      confirmedAt,
      expiresAt,
      createdAt,
      supplierId,
      planId
    FROM supplier_confirmations
    ORDER BY createdAt DESC
    LIMIT 20
  `);
  console.table(confirmations);
  
  // 查询邮件发送记录
  console.log('\n========== 邮件发送记录 ==========\n');
  const [emailLogs] = await connection.execute(`
    SELECT 
      id,
      recipientEmail,
      subject,
      status,
      errorMessage,
      sentAt,
      createdAt,
      supplierId,
      planId
    FROM email_send_logs
    ORDER BY createdAt DESC
    LIMIT 20
  `);
  console.table(emailLogs);
  
  // 查询供应商信息
  console.log('\n========== 供应商信息 ==========\n');
  const [suppliers] = await connection.execute(`
    SELECT 
      id,
      supplierName,
      contactPerson,
      contactEmail,
      createdAt
    FROM suppliers
    ORDER BY createdAt DESC
    LIMIT 10
  `);
  console.table(suppliers);
  
  await connection.end();
}

main().catch(console.error);
