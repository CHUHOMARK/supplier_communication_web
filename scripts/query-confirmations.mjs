import mysql from 'mysql2/promise';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  
  const connection = await mysql.createConnection(dbUrl);
  
  const [rows] = await connection.execute(
    'SELECT id, confirmToken, status, supplierId, planId FROM supplier_confirmations ORDER BY createdAt DESC LIMIT 5'
  );
  
  console.log('Recent confirmations:');
  console.table(rows);
  
  await connection.end();
}

main().catch(console.error);
