import * as db from "./server/db";

async function testBatchInsert() {
  try {
    // 创建测试用户
    console.log("创建测试用户...");
    const testUser = await db.createUser({
      username: `batch_test_${Date.now()}`,
      password: "test123",
      name: "Batch Test User",
      email: "batch_test@example.com",
      loginMethod: "local",
    });
    console.log(`✅ 用户创建成功，ID: ${testUser.id}`);
    
    // 准备250条测试数据（跨越3个批次）
    const testReceipts = [];
    for (let i = 1; i <= 250; i++) {
      testReceipts.push({
        userId: testUser.id,
        materialCode: `BATCH${String(i).padStart(3, "0")}`,
        businessDate: "2026-01-01",
        actualQuantity: (i * 10).toString(),
        supplierName: i % 3 === 0 ? null : `测试供应商${i}`,
      });
    }
    
    console.log(`\n准备插入 ${testReceipts.length} 条记录...`);
    console.log("第1条记录：", JSON.stringify(testReceipts[0], null, 2));
    console.log("第100条记录：", JSON.stringify(testReceipts[99], null, 2));
    console.log("第250条记录：", JSON.stringify(testReceipts[249], null, 2));
    
    // 调用分批插入函数
    console.log("\n开始分批插入...");
    await db.createActualReceipts(testReceipts);
    console.log("✅ 分批插入成功");
    
    // 查询数据
    console.log("\n查询插入的数据...");
    const receipts = await db.getActualReceiptsByUserId(testUser.id);
    console.log(`✅ 查询成功，共 ${receipts.length} 条记录`);
    
    if (receipts.length !== testReceipts.length) {
      console.error(`❌ 数据数量不匹配！期望 ${testReceipts.length}，实际 ${receipts.length}`);
    } else {
      console.log("✅ 数据数量匹配");
    }
    
  } catch (error: any) {
    console.error("❌ 测试失败:", error.message);
    if (error.sql) {
      console.error("SQL:", error.sql);
    }
    if (error.sqlMessage) {
      console.error("SQL错误:", error.sqlMessage);
    }
  }
}

testBatchInsert();
