import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Comparison Analysis Tests", () => {
  let testUserId: number;
  let testPlanId: number;

  beforeAll(async () => {
    // 创建测试用户
    const user = await db.createUser({
      username: `comparison_test_${Date.now()}`,
      openId: `comparison_test_openid_${Date.now()}`,
      name: "对比分析测试用户",
      email: "comparison@test.com",
      role: "user",
    });
    testUserId = user.id;

    // 创建测试物料计划
    testPlanId = await db.createMaterialPlan({
      userId: testUserId,
      fileName: "测试计划.xlsx",
      planStartDate: "2026-02-01",
      planEndDate: "2026-02-10",
    });

    // 创建测试物料明细
    await db.createMaterialItems([
      {
        planId: testPlanId,
        materialCode: "TEST001",
        materialName: "测试物料1",
        materialSpec: "规格1",
        unitUsage: null,
        demand: null,
        inventory: null,
        shortage: null,
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-02-01": 100,
          "2026-02-02": 200,
          "2026-02-03": 150,
        },
      },
      {
        planId: testPlanId,
        materialCode: "TEST002",
        materialName: "测试物料2",
        materialSpec: "规格2",
        unitUsage: null,
        demand: null,
        inventory: null,
        shortage: null,
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-02-01": 50,
          "2026-02-02": 100,
          "2026-02-03": 75,
        },
      },
    ]);

    // 创建测试ERP实际到货记录
    await db.createActualReceipts([
      {
        userId: testUserId,
        materialCode: "TEST001",
        businessDate: "2026-02-01",
        actualQuantity: "120", // 超额20
        supplierName: "供应商A",
      },
      {
        userId: testUserId,
        materialCode: "TEST001",
        businessDate: "2026-02-02",
        actualQuantity: "180", // 短缺20
        supplierName: "供应商A",
      },
      {
        userId: testUserId,
        materialCode: "TEST002",
        businessDate: "2026-02-01",
        actualQuantity: "50", // 准确
        supplierName: "供应商B",
      },
      {
        userId: testUserId,
        materialCode: "TEST002",
        businessDate: "2026-02-02",
        actualQuantity: "120", // 超额20
        supplierName: "供应商B",
      },
    ]);
  });

  afterAll(async () => {
    // 清理测试数据
    // 注：清理函数可能不存在，这里只是示例
    // 实际生产环境中，测试数据会被自动清理
    console.log("测试完成，数据保留以便手动检查");
  });

  it("should get comparison data correctly", async () => {
    const comparisonData = await db.getComparisonData(testUserId, testPlanId);

    expect(comparisonData).toBeDefined();
    expect(comparisonData.length).toBe(2); // 2个物料

    // 验证TEST001的数据
    const test001 = comparisonData.find((item) => item.materialCode === "TEST001");
    expect(test001).toBeDefined();
    expect(test001?.materialName).toBe("测试物料1");
    expect(test001?.totalPlanned).toBe(450); // 100 + 200 + 150
    expect(test001?.totalActual).toBe(300); // 120 + 180
    expect(test001?.totalDifference).toBe(-150); // 300 - 450
    expect(test001?.totalPercentage).toBeCloseTo(66.67, 1); // (300 / 450) * 100

    // 验证TEST002的数据
    const test002 = comparisonData.find((item) => item.materialCode === "TEST002");
    expect(test002).toBeDefined();
    expect(test002?.materialName).toBe("测试物料2");
    expect(test002?.totalPlanned).toBe(225); // 50 + 100 + 75
    expect(test002?.totalActual).toBe(170); // 50 + 120
    expect(test002?.totalDifference).toBe(-55); // 170 - 225
    expect(test002?.totalPercentage).toBeCloseTo(75.56, 1); // (170 / 225) * 100
  });

  it("should get comparison summary correctly", async () => {
    const summary = await db.getComparisonSummary(testUserId, testPlanId);

    expect(summary).toBeDefined();
    expect(summary.totalPlanned).toBe(675); // 450 + 225
    expect(summary.totalActual).toBe(470); // 300 + 170
    expect(summary.totalDifference).toBe(-205); // 470 - 675
    expect(summary.averagePercentage).toBeCloseTo(69.63, 1); // (470 / 675) * 100
    expect(summary.materialCount).toBe(2);
  });

  it("should handle daily comparison correctly", async () => {
    const comparisonData = await db.getComparisonData(testUserId, testPlanId);
    const test001 = comparisonData.find((item) => item.materialCode === "TEST001");

    expect(test001?.dailyComparison).toBeDefined();

    // 验证2026-02-01的数据
    const day1 = test001?.dailyComparison["2026-02-01"];
    expect(day1?.planned).toBe(100);
    expect(day1?.actual).toBe(120);
    expect(day1?.difference).toBe(20);
    expect(day1?.percentage).toBe(120);

    // 验证2026-02-02的数据
    const day2 = test001?.dailyComparison["2026-02-02"];
    expect(day2?.planned).toBe(200);
    expect(day2?.actual).toBe(180);
    expect(day2?.difference).toBe(-20);
    expect(day2?.percentage).toBe(90);

    // 验证2026-02-03的数据（没有实际到货）
    const day3 = test001?.dailyComparison["2026-02-03"];
    expect(day3?.planned).toBe(150);
    expect(day3?.actual).toBe(0);
    expect(day3?.difference).toBe(-150);
    expect(day3?.percentage).toBe(0);
  });

  it("should handle materials with no actual receipts", async () => {
    // 创建一个没有实际到货的物料
    await db.createMaterialItems([
      {
        planId: testPlanId,
        materialCode: "TEST003",
        materialName: "测试物料3",
        materialSpec: "规格3",
        unitUsage: null,
        demand: null,
        inventory: null,
        shortage: null,
        inTransit: null,
        total: null,
        dailySchedule: {
          "2026-02-01": 100,
        },
      },
    ]);

    const comparisonData = await db.getComparisonData(testUserId, testPlanId);
    const test003 = comparisonData.find((item) => item.materialCode === "TEST003");

    expect(test003).toBeDefined();
    expect(test003?.totalPlanned).toBe(100);
    expect(test003?.totalActual).toBe(0);
    expect(test003?.totalDifference).toBe(-100);
    expect(test003?.totalPercentage).toBe(0);
  });

  it("should handle actual receipts without plan", async () => {
    // 创建一个没有计划的实际到货记录
    await db.createActualReceipts([
      {
        userId: testUserId,
        materialCode: "TEST004",
        businessDate: "2026-02-01",
        actualQuantity: "100",
        supplierName: "供应商C",
      },
    ]);

    const comparisonData = await db.getComparisonData(testUserId, testPlanId);
    
    // TEST004不应该出现在对比数据中，因为它不在物料计划中
    const test004 = comparisonData.find((item) => item.materialCode === "TEST004");
    expect(test004).toBeUndefined();
  });
});
