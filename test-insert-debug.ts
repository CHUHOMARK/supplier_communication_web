import { drizzle } from "drizzle-orm/mysql2";
import { actualReceipts } from "./drizzle/schema";

async function testInsert() {
  const db = drizzle(process.env.DATABASE_URL!);
  
  const testData = [{
    userId: 999,
    materialCode: "DEBUG001",
    businessDate: "2026-01-01",
    actualQuantity: "100",
    supplierName: "调试供应商"
  }];
  
  console.log("测试数据：");
  console.log(JSON.stringify(testData, null, 2));
  
  try {
    // 生成SQL
    const query = db.insert(actualReceipts).values(testData);
    const sqlObj = query.toSQL();
    console.log("\nDrizzle生成的SQL：");
    console.log("SQL:", sqlObj.sql);
    console.log("Params:", JSON.stringify(sqlObj.params));
    
    // 尝试执行
    console.log("\n尝试执行插入...");
    const result = await query;
    console.log("✅ 插入成功！");
    console.log("结果：", result);
  } catch (error: any) {
    console.error("❌ 插入失败：", error.message);
    if (error.sql) {
      console.error("SQL:", error.sql);
    }
    if (error.sqlMessage) {
      console.error("SQL错误：", error.sqlMessage);
    }
  }
}

testInsert();
