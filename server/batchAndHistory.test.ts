import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("批量操作和历史功能", () => {
  it("应该能够删除映射关系", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建测试供应商
    const result = await caller.supplier.create({
      supplierName: "测试供应商A",
      contactPerson: "张三",
      email: "test@example.com",
    });

    // 创建映射
    await caller.mapping.upsert({
      materialCode: "TEST-001",
      suppliers: [
        {
          supplierId: result.supplierId,
          sharePercentage: 100,
          priority: 1,
        },
      ],
    });

    // 删除映射
    const deleteResult = await caller.mapping.delete({
      materialCode: "TEST-001",
    });

    expect(deleteResult.success).toBe(true);

    // 验证已删除
    const mappings = await caller.mapping.getByMaterialCode({
      materialCode: "TEST-001",
    });

    expect(mappings.length).toBe(0);
  });

  it("应该能够记录份额变更历史", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建测试供应商
    const result1 = await caller.supplier.create({
      supplierName: "供应商B",
      contactPerson: "李四",
      email: "supplier-b@example.com",
    });

    const result2 = await caller.supplier.create({
      supplierName: "供应商C",
      contactPerson: "王五",
      email: "supplier-c@example.com",
    });

    // 第一次创建映射
    await caller.mapping.upsert({
      materialCode: "TEST-002",
      suppliers: [
        {
          supplierId: result1.supplierId,
          sharePercentage: 60,
          priority: 1,
        },
        {
          supplierId: result2.supplierId,
          sharePercentage: 40,
          priority: 2,
        },
      ],
    });

    // 修改份额
    await caller.mapping.upsert({
      materialCode: "TEST-002",
      suppliers: [
        {
          supplierId: result1.supplierId,
          sharePercentage: 50,
          priority: 1,
        },
        {
          supplierId: result2.supplierId,
          sharePercentage: 50,
          priority: 2,
        },
      ],
    });

    // 获取变更历史
    const history = await caller.mapping.getChangeHistory({
      materialCode: "TEST-002",
    });

    // 应该记录了份额变更
    expect(history.length).toBeGreaterThan(0);
    expect(history.some(h => h.materialCode === "TEST-002")).toBe(true);
  });

  it("应该能够获取供应商统计信息", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建测试供应商
    const result = await caller.supplier.create({
      supplierName: "供应商D",
      contactPerson: "赵六",
      email: "supplier-d@example.com",
    });

    // 创建多个物料映射
    await caller.mapping.upsert({
      materialCode: "TEST-003",
      suppliers: [
        {
          supplierId: result.supplierId,
          sharePercentage: 100,
          priority: 1,
        },
      ],
    });

    await caller.mapping.upsert({
      materialCode: "TEST-004",
      suppliers: [
        {
          supplierId: result.supplierId,
          sharePercentage: 100,
          priority: 1,
        },
      ],
    });

    // 获取统计信息
    const stats = await caller.mapping.getSupplierStats({
      supplierId: result.supplierId,
    });

    expect(stats).toBeDefined();
    expect(stats?.materialCount).toBeGreaterThanOrEqual(2);
    expect(parseFloat(stats?.avgShare || "0")).toBeGreaterThan(0);
  });

  it("应该能够批量应用份额配置", { timeout: 15000 }, async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 创建测试供应商
    const result1 = await caller.supplier.create({
      supplierName: "供应商E",
      contactPerson: "孙七",
      email: "supplier-e@example.com",
    });

    const result2 = await caller.supplier.create({
      supplierName: "供应商F",
      contactPerson: "周八",
      email: "supplier-f@example.com",
    });

    // 批量应用相同的份额配置到多个物料
    const materials = ["TEST-005", "TEST-006", "TEST-007"];
    const suppliers = [
      {
        supplierId: result1.supplierId,
        sharePercentage: 60,
        priority: 1,
      },
      {
        supplierId: result2.supplierId,
        sharePercentage: 40,
        priority: 2,
      },
    ];

    for (const materialCode of materials) {
      await caller.mapping.upsert({
        materialCode,
        suppliers,
      });
    }

    // 验证所有物料都应用了相同的配置
    for (const materialCode of materials) {
      const mappings = await caller.mapping.getByMaterialCode({ materialCode });
      expect(mappings.length).toBe(2);
      expect(mappings[0].sharePercentage).toBe("60.00");
      expect(mappings[1].sharePercentage).toBe("40.00");
    }
  });
});
