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

describe("Charts and Notifications API", () => {
  let testUser: User;

  beforeAll(async () => {
    // 获取或创建测试用户
    const existingUser = await db.getUserByUsername("testuser_charts");
    if (existingUser) {
      testUser = existingUser;
    } else {
      await db.createUser({
        username: "testuser_charts",
        password: "hashedpassword",
        name: "Charts Test User",
      });
      const user = await db.getUserByUsername("testuser_charts");
      if (!user) throw new Error("Failed to create test user");
      testUser = user;
    }
  });

  describe("Dashboard Charts", () => {
    it("should return email send trend data", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const trend = await caller.dashboard.getEmailSendTrend({ days: 30 });

      expect(trend).toBeDefined();
      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBe(30); // 应该返回30天的数据
      
      if (trend.length > 0) {
        expect(trend[0]).toHaveProperty("date");
        expect(trend[0]).toHaveProperty("count");
        expect(typeof trend[0].count).toBe("number");
      }
    });

    it("should return confirmation rate trend data", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const trend = await caller.dashboard.getConfirmationRateTrend({ days: 30 });

      expect(trend).toBeDefined();
      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBe(30);
      
      if (trend.length > 0) {
        expect(trend[0]).toHaveProperty("date");
        expect(trend[0]).toHaveProperty("total");
        expect(trend[0]).toHaveProperty("confirmed");
        expect(trend[0]).toHaveProperty("rate");
        expect(typeof trend[0].rate).toBe("number");
        expect(trend[0].rate).toBeGreaterThanOrEqual(0);
        expect(trend[0].rate).toBeLessThanOrEqual(100);
      }
    });

    it("should return supplier response time stats", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const stats = await caller.dashboard.getSupplierResponseTimeStats();

      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      
      if (stats.length > 0) {
        expect(stats[0]).toHaveProperty("supplierId");
        expect(stats[0]).toHaveProperty("supplierName");
        expect(stats[0]).toHaveProperty("avgResponseTime");
        expect(stats[0]).toHaveProperty("count");
        expect(typeof stats[0].avgResponseTime).toBe("number");
        expect(stats[0].avgResponseTime).toBeGreaterThan(0);
      }
    });

    it("should require authentication for chart data", async () => {
      const caller = appRouter.createCaller(createMockContext(null));

      await expect(caller.dashboard.getEmailSendTrend({ days: 30 })).rejects.toThrow("Please login");
      await expect(caller.dashboard.getConfirmationRateTrend({ days: 30 })).rejects.toThrow("Please login");
      await expect(caller.dashboard.getSupplierResponseTimeStats()).rejects.toThrow("Please login");
    });

    it("should support custom day ranges for trends", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const trend7 = await caller.dashboard.getEmailSendTrend({ days: 7 });
      const trend90 = await caller.dashboard.getEmailSendTrend({ days: 90 });

      expect(trend7.length).toBe(7);
      expect(trend90.length).toBe(90);
    });
  });

  describe("Notification Center", () => {
    it("should return notification list for authenticated user", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const notifications = await caller.notifications.getList({ limit: 20 });

      expect(notifications).toBeDefined();
      expect(Array.isArray(notifications)).toBe(true);
      
      if (notifications.length > 0) {
        expect(notifications[0]).toHaveProperty("id");
        expect(notifications[0]).toHaveProperty("userId");
        expect(notifications[0]).toHaveProperty("type");
        expect(notifications[0]).toHaveProperty("title");
        expect(notifications[0]).toHaveProperty("content");
        expect(notifications[0]).toHaveProperty("isRead");
      }
    });

    it("should return unread notification count", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      const count = await caller.notifications.getUnreadCount();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should mark notification as read", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      // 先创建一个测试通知
      await db.createNotification({
        userId: testUser.id,
        type: "system",
        title: "测试通知",
        content: "这是一个测试通知",
      });

      const notifications = await caller.notifications.getList({ limit: 1 });
      if (notifications.length > 0) {
        const notificationId = notifications[0].id;
        const result = await caller.notifications.markAsRead({ id: notificationId });
        expect(result).toBe(true);

        // 验证已标记为已读
        const updated = await caller.notifications.getList({ limit: 1 });
        const updatedNotification = updated.find(n => n.id === notificationId);
        if (updatedNotification) {
          expect(updatedNotification.isRead).toBe(true);
        }
      }
    });

    it("should mark all notifications as read", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      // 创建多个未读通知
      await db.createNotification({
        userId: testUser.id,
        type: "system",
        title: "测试通知1",
        content: "测试内容1",
      });
      await db.createNotification({
        userId: testUser.id,
        type: "system",
        title: "测试通知2",
        content: "测试内容2",
      });

      const result = await caller.notifications.markAllAsRead();
      expect(result).toBe(true);

      // 验证未读数量为0
      const unreadCount = await caller.notifications.getUnreadCount();
      expect(unreadCount).toBe(0);
    });

    it("should delete notification", async () => {
      const caller = appRouter.createCaller(createMockContext(testUser));

      // 创建一个测试通知
      await db.createNotification({
        userId: testUser.id,
        type: "system",
        title: "待删除通知",
        content: "这个通知将被删除",
      });

      const notifications = await caller.notifications.getList({ limit: 1 });
      if (notifications.length > 0) {
        const notificationId = notifications[0].id;
        const result = await caller.notifications.delete({ id: notificationId });
        expect(result).toBe(true);
      }
    });

    it("should require authentication for notifications", async () => {
      const caller = appRouter.createCaller(createMockContext(null));

      await expect(caller.notifications.getList({ limit: 20 })).rejects.toThrow("Please login");
      await expect(caller.notifications.getUnreadCount()).rejects.toThrow("Please login");
    });
  });
});
