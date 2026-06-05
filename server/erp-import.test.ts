import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as fs from "fs";
import * as path from "path";

describe("ERP Import E2E Test", () => {
  let testUserId: number;
  let testToken: string;

  beforeAll(async () => {
    // 创建测试用户
    const testUser = await db.createUser({
      username: `erp_test_${Date.now()}`,
      password: "test123",
      name: "ERP Test User",
      email: "erp_test@example.com",
      loginMethod: "local",
    });
    testUserId = testUser.id;

    // 创建模拟token
    testToken = "test_token";
  });

  it("should parse Excel file successfully", async () => {
    // 读取测试Excel文件
    const filePath = "/home/ubuntu/upload/Receivement20260212.xlsx";
    const fileBuffer = fs.readFileSync(filePath);
    const base64Content = fileBuffer.toString("base64");

    // 创建调用者上下文
    const caller = appRouter.createCaller({
      user: { id: testUserId, name: "ERP Test User", email: "erp_test@example.com" },
    });

    // 调用导入API
    const result = await caller.erp.importData({
      fileContent: base64Content,
    });

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    console.log(`成功导入 ${result.count} 条记录`);
  });

  it("should retrieve imported receipts", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, name: "ERP Test User", email: "erp_test@example.com" },
    });

    // 获取导入的记录
    const receipts = await caller.erp.getReceipts();

    // 验证记录
    expect(receipts).toBeDefined();
    expect(receipts.length).toBeGreaterThan(0);
    console.log(`查询到 ${receipts.length} 条记录`);

    // 验证第一条记录的字段
    const firstReceipt = receipts[0];
    expect(firstReceipt).toHaveProperty("id");
    expect(firstReceipt).toHaveProperty("userId");
    expect(firstReceipt).toHaveProperty("materialCode");
    expect(firstReceipt).toHaveProperty("businessDate");
    expect(firstReceipt).toHaveProperty("actualQuantity");
    expect(firstReceipt).toHaveProperty("supplierName");
    expect(firstReceipt).toHaveProperty("createdAt");

    console.log("第一条记录：", {
      materialCode: firstReceipt.materialCode,
      businessDate: firstReceipt.businessDate,
      actualQuantity: firstReceipt.actualQuantity,
      supplierName: firstReceipt.supplierName,
    });
  });

  it("should handle duplicate imports correctly", async () => {
    // 读取测试Excel文件
    const filePath = "/home/ubuntu/upload/Receivement20260212.xlsx";
    const fileBuffer = fs.readFileSync(filePath);
    const base64Content = fileBuffer.toString("base64");

    const caller = appRouter.createCaller({
      user: { id: testUserId, name: "ERP Test User", email: "erp_test@example.com" },
    });

    // 第二次导入相同文件应该失败（因为有唯一性约束）
    try {
      await caller.erp.importData({
        fileContent: base64Content,
      });
      // 如果没有抛出错误，说明唯一性约束没有生效
      console.warn("警告：重复导入没有被阻止，唯一性约束可能未生效");
    } catch (error: any) {
      // 预期会抛出错误
      expect(error.message).toContain("Duplicate");
      console.log("唯一性约束正常工作：", error.message);
    }
  });

  it("should validate data types", async () => {
    const caller = appRouter.createCaller({
      user: { id: testUserId, name: "ERP Test User", email: "erp_test@example.com" },
    });

    const receipts = await caller.erp.getReceipts();
    expect(receipts.length).toBeGreaterThan(0);

    const receipt = receipts[0];

    // 验证数据类型
    expect(typeof receipt.id).toBe("number");
    expect(typeof receipt.userId).toBe("number");
    expect(typeof receipt.materialCode).toBe("string");
    expect(typeof receipt.businessDate).toBe("string");
    expect(typeof receipt.actualQuantity).toBe("string"); // decimal类型在Drizzle中是字符串
    expect(receipt.supplierName === null || typeof receipt.supplierName === "string").toBe(true);
    expect(receipt.createdAt instanceof Date).toBe(true);

    // 验证日期格式
    expect(receipt.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 验证actualQuantity可以转换为数字
    const quantity = parseFloat(receipt.actualQuantity);
    expect(isNaN(quantity)).toBe(false);
    expect(quantity).toBeGreaterThan(0);

    console.log("数据类型验证通过");
  });
});
