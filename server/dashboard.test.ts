import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { User } from "../drizzle/schema";

// Mock context for testing
const createMockContext = (user: User | null = null) => ({
  req: {
    headers: {},
    protocol: "http",
  } as any,
  res: {
    cookie: () => {},
    clearCookie: () => {},
  } as any,
  user,
});

describe("Dashboard API", () => {
  let testUser: User;

  beforeAll(async () => {
    // 获取或创建测试用户
    const existingUser = await db.getUserByUsername("testuser_dashboard");
    if (existingUser) {
      testUser = existingUser;
    } else {
      await db.createUser({
        username: "testuser_dashboard",
        password: "hashedpassword",
        name: "Dashboard Test User",
      });
      const user = await db.getUserByUsername("testuser_dashboard");
      if (!user) throw new Error("Failed to create test user");
      testUser = user;
    }
  });

  describe("Dashboard Statistics", () => {
    it("should return dashboard statistics for authenticated user", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const stats = await caller.dashboard.getStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("materialPlans");
      expect(stats).toHaveProperty("suppliers");
      expect(stats).toHaveProperty("emailsSent");
      expect(stats).toHaveProperty("pendingConfirmations");
      
      expect(typeof stats.materialPlans).toBe("number");
      expect(typeof stats.suppliers).toBe("number");
      expect(typeof stats.emailsSent).toBe("number");
      expect(typeof stats.pendingConfirmations).toBe("number");
      
      expect(stats.materialPlans).toBeGreaterThanOrEqual(0);
      expect(stats.suppliers).toBeGreaterThanOrEqual(0);
      expect(stats.emailsSent).toBeGreaterThanOrEqual(0);
      expect(stats.pendingConfirmations).toBeGreaterThanOrEqual(0);
    });

    it("should require authentication", async () => {
      const caller = appRouter.createCaller(createMockContext(null));

      await expect(caller.dashboard.getStats()).rejects.toThrow("Please login");
    });

    it("should return zero values for new user with no data", async () => {
      // 创建一个全新的用户
      const newUsername = `newuser_${Date.now()}`;
      await db.createUser({
        username: newUsername,
        password: "hashedpassword",
        name: "New User",
      });
      
      const newUser = await db.getUserByUsername(newUsername);
      if (!newUser) throw new Error("Failed to create new user");

      const caller = appRouter.createCaller(createMockContext(newUser));
      const stats = await caller.dashboard.getStats();

      expect(stats.materialPlans).toBe(0);
      expect(stats.suppliers).toBe(0);
      expect(stats.emailsSent).toBe(0);
      expect(stats.pendingConfirmations).toBe(0);
    });

    it("should correctly aggregate user data", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const stats = await caller.dashboard.getStats();
      
      // 验证数据一致性
      const dataStats = await db.getUserDataStats(testUser.id);
      const confirmStats = await db.getConfirmationStatsByUserId(testUser.id);

      expect(stats.materialPlans).toBe(dataStats.materialPlans);
      expect(stats.suppliers).toBe(dataStats.suppliers);
      expect(stats.emailsSent).toBe(dataStats.emailLogs);
      expect(stats.pendingConfirmations).toBe(confirmStats.pending);
    });

    it("should handle concurrent requests", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      // 并发请求
      const requests = Array(5).fill(null).map(() => caller.dashboard.getStats());
      const results = await Promise.all(requests);

      // 所有结果应该相同
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).toEqual(firstResult);
      });
    });
  });
});
