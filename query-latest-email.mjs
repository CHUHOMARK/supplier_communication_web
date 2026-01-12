import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'localhost',
  user: 'root',
  password: process.env.DATABASE_URL?.split(':')[1]?.split('@')[0] || '',
  database: 'supplier_communication_web',
});

const [rows] = await connection.execute(
  'SELECT id, supplier_id, plan_id, content, created_at FROM email_send_logs ORDER BY created_at DESC LIMIT 1'
);

if (rows.length > 0) {
  const email = rows[0];
  console.log('Latest Email:');
  console.log('ID:', email.id);
  console.log('Supplier ID:', email.supplier_id);
  console.log('Content Preview:', email.content.substring(0, 500));
  
  // Extract confirmation URL from content
  const urlMatch = email.content.match(/https?:\/\/[^\s<>"]+\/confirm\/[^\s<>"]+/);
  if (urlMatch) {
    console.log('\nConfirmation URL:', urlMatch[0]);
  }
}

await connection.end();
