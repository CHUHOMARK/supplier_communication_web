import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import bcrypt from "bcrypt";
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

describe("Local Authentication", () => {
  const testUsername = `testuser_${Date.now()}`;
  const testPassword = "password123";
  let createdUserId: number | null = null;

  afterAll(async () => {
    // Clean up test user
    if (createdUserId) {
      const dbInstance = await db.getDb();
      if (dbInstance) {
        await dbInstance.execute(`DELETE FROM users WHERE id = ${createdUserId}`);
      }
    }
  });

  describe("User Registration", () => {
    it("should register a new user successfully", async () => {
      const caller = appRouter.createCaller(createMockContext());
      
      const result = await caller.auth.register({
        username: testUsername,
        password: testPassword,
        name: "Test User",
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("注册成功");

      // Verify user was created in database
      const user = await db.getUserByUsername(testUsername);
      expect(user).toBeDefined();
      expect(user?.username).toBe(testUsername);
      expect(user?.name).toBe("Test User");
      expect(user?.email).toBe("test@example.com");
      expect(user?.password).toBeDefined();
      
      if (user) {
        createdUserId = user.id;
      }
    });

    it("should reject registration with duplicate username", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.auth.register({
          username: testUsername,
          password: "anotherpassword",
        })
      ).rejects.toThrow("用户名已存在");
    });

    it("should reject registration with short username", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.auth.register({
          username: "ab",
          password: testPassword,
        })
      ).rejects.toThrow();
    });

    it("should reject registration with short password", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.auth.register({
          username: "validusername",
          password: "12345",
        })
      ).rejects.toThrow();
    });
  });

  describe("User Login", () => {
    it("should login successfully with correct credentials", async () => {
      const mockRes = {
        cookie: (name: string, value: string, options: any) => {
          expect(name).toBe("app_session_id");
          expect(value).toBeDefined();
          expect(options.maxAge).toBeGreaterThan(0);
        },
        clearCookie: () => {},
      };

      const caller = appRouter.createCaller({
        req: {
          headers: {},
          protocol: "http",
        } as any,
        res: mockRes as any,
        user: null,
      });

      const result = await caller.auth.login({
        username: testUsername,
        password: testPassword,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(testUsername);
      expect(result.user.name).toBe("Test User");
    });

    it("should reject login with incorrect password", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.auth.login({
          username: testUsername,
          password: "wrongpassword",
        })
      ).rejects.toThrow("用户名或密码错误");
    });

    it("should reject login with non-existent username", async () => {
      const caller = appRouter.createCaller(createMockContext());

      await expect(
        caller.auth.login({
          username: "nonexistentuser",
          password: testPassword,
        })
      ).rejects.toThrow("用户名或密码错误");
    });

    it("should set longer cookie expiry with rememberMe", async () => {
      let cookieMaxAge = 0;
      
      const mockRes = {
        cookie: (name: string, value: string, options: any) => {
          cookieMaxAge = options.maxAge;
        },
        clearCookie: () => {},
      };

      const caller = appRouter.createCaller({
        req: {
          headers: {},
          protocol: "http",
        } as any,
        res: mockRes as any,
        user: null,
      });

      await caller.auth.login({
        username: testUsername,
        password: testPassword,
        rememberMe: true,
      });

      // 30 days in milliseconds
      expect(cookieMaxAge).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe("Password Security", () => {
    it("should hash passwords before storing", async () => {
      const user = await db.getUserByUsername(testUsername);
      expect(user).toBeDefined();
      expect(user?.password).toBeDefined();
      
      // Password should not be stored in plain text
      expect(user?.password).not.toBe(testPassword);
      
      // Password should be a bcrypt hash
      if (user?.password) {
        const isValid = await bcrypt.compare(testPassword, user.password);
        expect(isValid).toBe(true);
      }
    });
  });

  describe("User Logout", () => {
    it("should clear session cookie on logout", async () => {
      let cookieCleared = false;
      
      const mockRes = {
        cookie: () => {},
        clearCookie: (name: string, options: any) => {
          expect(name).toBe("app_session_id");
          expect(options.maxAge).toBe(-1);
          cookieCleared = true;
        },
      };

      const caller = appRouter.createCaller({
        req: {
          headers: {},
          protocol: "http",
        } as any,
        res: mockRes as any,
        user: null,
      });

      const result = await caller.auth.logout();
      
      expect(result.success).toBe(true);
      expect(cookieCleared).toBe(true);
    });
  });
});
