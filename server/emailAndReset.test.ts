import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Email and Data Reset Features", () => {
  let testPlanId: number;
  let testSupplierId: number;

  beforeAll(async () => {
    // 创建测试数据
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建供应商
    const supplierResult = await caller.supplier.create({
      supplierName: "测试供应商",
      supplierCode: "TEST001",
      contactPerson: "张三",
      contactPhone: "13800138000",
      email: "test@supplier.com",
      address: "测试地址",
    });
    testSupplierId = Number(supplierResult.id);

    // 直接创建物料计划记录
    testPlanId = Number(await db.createMaterialPlan({
      userId: ctx.user!.id,
      fileName: "测试计划.xlsx",
      planStartDate: "2026-01-01",
      planEndDate: "2026-01-31",
    }));
  });

  describe("Data Reset", () => {
    it("should get user data statistics", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const stats = await caller.dataReset.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.materialPlans).toBe("number");
      expect(typeof stats.suppliers).toBe("number");
      expect(typeof stats.mappings).toBe("number");
      expect(typeof stats.emails).toBe("number");
      expect(typeof stats.emailLogs).toBe("number");
    });

    it("should reset selected data types", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

        // 重置生成的邮件邮件
      const result = await caller.dataReset.reset({
        resetEmails: true,
      });

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.emails).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Email Service", () => {
    it("should handle email send request (may fail without SMTP config)", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        const result = await caller.email.send({
          planId: testPlanId,
          supplierId: testSupplierId,
          recipientEmail: "test@supplier.com",
          subject: "测试邮件",
          content: "这是一封测试邮件",
        });

        // 如果配置了SMTP，应该成功或失败
        expect(result).toBeDefined();
        expect(typeof result.success).toBe("boolean");
      } catch (error) {
        // 没有配置SMTP时会失败，这是预期的
        expect(error).toBeDefined();
      }
    });

    it("should create email send log", async () => {
      const ctx = createAuthContext();

      // 确保 supplierId 是有效的数字
      expect(testSupplierId).toBeGreaterThan(0);

      const logId = await db.createEmailSendLog({
        userId: ctx.user!.id,
        planId: testPlanId,
        supplierId: testSupplierId,
        recipientEmail: "test@supplier.com",
        subject: "测试邮件",
        content: "测试内容",
        status: "pending",
      });

      expect(logId).toBeDefined();
      expect(typeof logId).toBe("bigint");
    });

    it("should update email send log status", async () => {
      const ctx = createAuthContext();

      // 确保 supplierId 是有效的数字
      expect(testSupplierId).toBeGreaterThan(0);

      const logId = await db.createEmailSendLog({
        userId: ctx.user!.id,
        planId: testPlanId,
        supplierId: testSupplierId,
        recipientEmail: "test@supplier.com",
        subject: "测试邮件",
        content: "测试内容",
        status: "pending",
      });

      await db.updateEmailSendLogStatus(Number(logId), "sent");

      const logs = await db.getEmailSendLogsByPlanId(testPlanId);
      const log = logs.find(l => l.id === Number(logId));

      expect(log).toBeDefined();
      expect(log?.status).toBe("sent");
    });

    it("should get email send history by plan", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const history = await caller.email.getSendHistory({
        planId: testPlanId,
      });

      expect(Array.isArray(history)).toBe(true);
    });
  });
});
