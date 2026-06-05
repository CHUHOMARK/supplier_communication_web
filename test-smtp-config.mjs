import * as dbModule from "./server/db.ts";
import * as schemaModule from "./drizzle/schema.ts";

const db = dbModule.db;
const smtpAccounts = schemaModule.smtpAccounts;
import { eq, and } from "drizzle-orm";

console.log("=== 测试SMTP账号配置 ===\n");

try {
  // 查询所有SMTP账号
  const allAccounts = await db.select().from(smtpAccounts);
  console.log(`✓ 数据库中共有 ${allAccounts.length} 个SMTP账号\n`);
  
  if (allAccounts.length > 0) {
    allAccounts.forEach((account, index) => {
      console.log(`账号 #${index + 1}:`);
      console.log(`  - ID: ${account.id}`);
      console.log(`  - 账号名称: ${account.accountName}`);
      console.log(`  - 发件人邮箱: ${account.fromEmail}`);
      console.log(`  - 发件人名称: ${account.fromName}`);
      console.log(`  - SMTP服务器: ${account.smtpHost}:${account.smtpPort}`);
      console.log(`  - SMTP用户名: ${account.smtpUser}`);
      console.log(`  - 使用SSL: ${account.smtpSecure ? '是' : '否'}`);
      console.log(`  - 是否默认: ${account.isDefault ? '是' : '否'}`);
      console.log(`  - 是否启用: ${account.isActive ? '是' : '否'}`);
      console.log(`  - 用户ID: ${account.userId}`);
      console.log();
    });
    
    // 查询默认账号
    const defaultAccount = allAccounts.find(acc => acc.isDefault && acc.isActive);
    if (defaultAccount) {
      console.log("✓ 找到默认SMTP账号:");
      console.log(`  - 账号名称: ${defaultAccount.accountName}`);
      console.log(`  - 发件人邮箱: ${defaultAccount.fromEmail}`);
      console.log(`  - SMTP服务器: ${defaultAccount.smtpHost}:${defaultAccount.smtpPort}`);
    } else {
      console.log("✗ 未找到默认且启用的SMTP账号");
    }
  } else {
    console.log("✗ 数据库中没有SMTP账号配置");
  }
  
  process.exit(0);
} catch (error) {
  console.error("✗ 测试失败:", error.message);
  process.exit(1);
}
