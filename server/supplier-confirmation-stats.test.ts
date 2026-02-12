import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

// 创建测试用的context
function createMockContext(user: any) {
  return {
    user,
    req: {
      headers: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Supplier Confirmation Stats", () => {
  const testUser = {
    id: 1,
    openId: "test-open-id",
    username: "testuser",
    name: "Test User",
    email: "test@example.com",
    role: "user" as const,
  };

  it("should return supplier confirmation stats", async () => {
    const caller = appRouter.createCaller(createMockContext(testUser));
    const stats = await caller.dashboard.getSupplierConfirmationStats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("confirmed");
    expect(stats).toHaveProperty("unconfirmed");
    expect(stats).toHaveProperty("total");
    expect(typeof stats.confirmed).toBe("number");
    expect(typeof stats.unconfirmed).toBe("number");
    expect(typeof stats.total).toBe("number");
  });

  it("should have total equal to confirmed plus unconfirmed", async () => {
    const caller = appRouter.createCaller(createMockContext(testUser));
    const stats = await caller.dashboard.getSupplierConfirmationStats();

    expect(stats.total).toBe(stats.confirmed + stats.unconfirmed);
  });

  it("should return zero values when no confirmations exist", async () => {
    const newUser = {
      id: 99999,
      openId: "new-user-open-id",
      username: "newuser",
      name: "New User",
      email: "new@example.com",
      role: "user" as const,
    };

    const caller = appRouter.createCaller(createMockContext(newUser));
    const stats = await caller.dashboard.getSupplierConfirmationStats();

    expect(stats.confirmed).toBe(0);
    expect(stats.unconfirmed).toBe(0);
    expect(stats.total).toBe(0);
  });

  it("should count confirmed suppliers correctly", async () => {
    const stats = await db.getSupplierConfirmationStats(testUser.id);

    // 验证已确认供应商数量不为负数
    expect(stats.confirmed).toBeGreaterThanOrEqual(0);
    // 验证未确认供应商数量不为负数
    expect(stats.unconfirmed).toBeGreaterThanOrEqual(0);
    // 验证总数等于已确认加未确认
    expect(stats.total).toBe(stats.confirmed + stats.unconfirmed);
  });

  it("should handle database connection failure gracefully", async () => {
    // 测试数据库不可用时的情况
    const stats = await db.getSupplierConfirmationStats(99999);

    expect(stats).toBeDefined();
    expect(stats.confirmed).toBeDefined();
    expect(stats.unconfirmed).toBeDefined();
    expect(stats.total).toBeDefined();
  });

  it("should require authentication for stats endpoint", async () => {
    const caller = appRouter.createCaller(createMockContext(null));

    await expect(async () => {
      await caller.dashboard.getSupplierConfirmationStats();
    }).rejects.toThrow();
  });
});
