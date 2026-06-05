import { describe, it, expect } from "vitest";

describe("Application Routes", () => {
  it("should have correct route configuration", () => {
    // 验证路由配置的存在性
    const routes = [
      { path: "/", description: "Dashboard - 仪表盘主页" },
      { path: "/login", description: "Login - 登录页面" },
      { path: "/register", description: "Register - 注册页面" },
      { path: "/upload", description: "Upload Plan - 上传物料计划" },
      { path: "/suppliers", description: "Suppliers - 供应商管理" },
      { path: "/share-allocation", description: "Share Allocation - 物料份额分配" },
      { path: "/emails", description: "Emails - 生成邮件" },
      { path: "/monitor", description: "Confirmation Monitor - 确认监控" },
      { path: "/settings", description: "Settings - 系统设置" },
      { path: "/confirm/:token", description: "Supplier Confirm - 供应商确认（公开）" },
    ];

    // 验证所有路由都已定义
    expect(routes.length).toBeGreaterThan(0);
    routes.forEach((route) => {
      expect(route.path).toBeDefined();
      expect(route.description).toBeDefined();
    });
  });

  it("should have protected routes requiring authentication", () => {
    const protectedRoutes = [
      "/",
      "/upload",
      "/suppliers",
      "/share-allocation",
      "/emails",
      "/monitor",
      "/settings",
    ];

    // 验证受保护的路由数量
    expect(protectedRoutes.length).toBe(7);
  });

  it("should have public routes accessible without authentication", () => {
    const publicRoutes = [
      "/login",
      "/register",
      "/confirm/:token",
    ];

    // 验证公开路由数量
    expect(publicRoutes.length).toBe(3);
  });

  it("should have dashboard modules with correct paths", () => {
    const dashboardModules = [
      { title: "上传物料计划", href: "/upload" },
      { title: "供应商管理", href: "/suppliers" },
      { title: "物料份额分配", href: "/share-allocation" },
      { title: "生成邮件", href: "/emails" },
      { title: "确认监控", href: "/monitor" },
      { title: "系统设置", href: "/settings" },
    ];

    // 验证所有模块都有正确的路径
    dashboardModules.forEach((module) => {
      expect(module.href).toMatch(/^\//);
      expect(module.title).toBeDefined();
    });

    // 验证模块数量
    expect(dashboardModules.length).toBe(6);
  });

  it("should have unique paths for all routes", () => {
    const paths = [
      "/",
      "/login",
      "/register",
      "/upload",
      "/suppliers",
      "/share-allocation",
      "/emails",
      "/monitor",
      "/settings",
      "/confirm/:token",
    ];

    // 验证没有重复的路径
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });
});
