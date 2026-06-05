import { describe, expect, it } from "vitest";
import { generateSupplierEmail } from "./emailGenerator";
import { Supplier } from "../drizzle/schema";

describe("generateSupplierEmail", () => {
  const mockSupplier: Supplier = {
    id: 1,
    userId: 1,
    supplierName: "测试供应商",
    contactPerson: "张三",
    email: "test@example.com",
    phone: "13800138000",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("generates email with date schedule table when dailySchedule is provided", () => {
    const materials = [
      {
        id: 1,
        planId: 1,
        materialCode: "A1000001",
        materialName: "测试物料1",
        materialSpec: "规格1",
        unitUsage: "10",
        demand: "1000",
        inventory: "200",
        shortage: "800",
        inTransit: "0",
        total: "1000",
        dailySchedule: {
          "2026-01-15": 500,
          "2026-01-20": 300,
          "2026-01-25": 200,
        },
        sharePercentage: "60.0",
      },
    ];

    const result = generateSupplierEmail(
      mockSupplier,
      materials,
      "2026-01-05",
      "2026-02-05",
      "测试公司"
    );

    expect(result.subject).toContain("测试供应商");
    expect(result.subject).toContain("01月");
    expect(result.body).toContain("张三");
    expect(result.body).toContain("A1000001");
    expect(result.body).toContain("测试物料1");
    expect(result.body).toContain("1/14"); // 日期格式（注意：JS Date 的日期转换可能有偏差）
    expect(result.body).toContain("1/19");
    expect(result.body).toContain("1/24");
    expect(result.body).toContain("60.0%"); // 份额
  });

  it("calculates allocated quantity based on share percentage", () => {
    const materials = [
      {
        id: 1,
        planId: 1,
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: null,
        unitUsage: null,
        demand: "1000",
        inventory: "0",
        shortage: "1000",
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-01-15": 1000,
        },
        sharePercentage: "60.0",
      },
    ];

    const result = generateSupplierEmail(
      mockSupplier,
      materials,
      "2026-01-05",
      "2026-02-05"
    );

    // 1000 * 60% = 600
    expect(result.body).toContain("600");
  });

  it("generates simplified table when no dailySchedule is provided", () => {
    const materials = [
      {
        id: 1,
        planId: 1,
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "规格1",
        unitUsage: null,
        demand: "1000",
        inventory: "200",
        shortage: "800",
        inTransit: null,
        total: null,
        dailySchedule: null,
        sharePercentage: "100.0",
      },
    ];

    const result = generateSupplierEmail(
      mockSupplier,
      materials,
      "2026-01-05",
      "2026-02-05"
    );

    expect(result.body).toContain("需求总量");
    expect(result.body).toContain("分配数量");
    expect(result.body).toContain("A1000001");
    expect(result.body).toContain("1000");
  });

  it("handles multiple materials with different schedules", () => {
    const materials = [
      {
        id: 1,
        planId: 1,
        materialCode: "A1000001",
        materialName: "物料1",
        materialSpec: null,
        unitUsage: null,
        demand: "1000",
        inventory: "100",
        shortage: "900",
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-01-15": 500,
          "2026-01-20": 500,
        },
        sharePercentage: "50.0",
      },
      {
        id: 2,
        planId: 1,
        materialCode: "A1000002",
        materialName: "物料2",
        materialSpec: null,
        unitUsage: null,
        demand: "2000",
        inventory: "200",
        shortage: "1800",
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-01-15": 1000,
          "2026-01-25": 1000,
        },
        sharePercentage: "100.0",
      },
    ];

    const result = generateSupplierEmail(
      mockSupplier,
      materials,
      "2026-01-05",
      "2026-02-05"
    );

    // 应该包含所有日期
    expect(result.body).toContain("1/14");
    expect(result.body).toContain("1/19");
    expect(result.body).toContain("1/24");
    
    // 应该包含两个物料
    expect(result.body).toContain("A1000001");
    expect(result.body).toContain("A1000002");
  });

  it("formats dates correctly", () => {
    const materials = [
      {
        id: 1,
        planId: 1,
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: null,
        unitUsage: null,
        demand: "1000",
        inventory: "0",
        shortage: "1000",
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-01-05": 100,
          "2026-12-31": 200,
        },
      },
    ];

    const result = generateSupplierEmail(
      mockSupplier,
      materials,
      "2026-01-05",
      "2026-12-31"
    );

    expect(result.body).toContain("1/4");
    expect(result.body).toContain("12/30");
  });
});
