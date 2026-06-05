import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'localhost',
  user: 'root',
  password: process.env.DATABASE_URL?.split(':')[1]?.split('@')[0] || '',
  database: 'supplier_communication_web',
});

const [rows] = await connection.execute(
  'SELECT id, content FROM email_send_logs WHERE status = "sent" ORDER BY created_at DESC LIMIT 1'
);

if (rows.length > 0) {
  const email = rows[0];
  console.log('Latest Sent Email:');
  console.log('ID:', email.id);
  
  // Extract confirmation URL from content
  const urlMatch = email.content.match(/https?:\/\/[^\s<>"]+\/confirm\/[^\s<>"]+/);
  if (urlMatch) {
    console.log('Confirmation URL:', urlMatch[0]);
  } else {
    console.log('No confirmation URL found');
    console.log('Content preview:', email.content.substring(0, 300));
  }
}

await connection.end();
