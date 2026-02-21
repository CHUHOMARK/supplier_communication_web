import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("供应商绩效报表功能测试", () => {
  let testUserId: number;
  let testPlanId: number;
  let testSupplierId: number;

  beforeAll(async () => {
    // 创建测试用户
    const testUser = await db.createUser({
      openId: `test_performance_${Date.now()}`,
      username: `test_performance_user_${Date.now()}`,
      name: "Test Performance User",
      email: "test_performance@example.com",
      loginMethod: "oauth",
    });
    testUserId = testUser.id;

    // 创建测试物料计划
    const testPlan = await db.createMaterialPlan({
      userId: testUserId,
      fileName: "test_performance_plan.xlsx",
      planStartDate: "2026-01-05",
      planEndDate: "2026-01-10",
    });
    testPlanId = testPlan.id;

    // 创建测试供应商
    const testSupplier = await db.createSupplier({
      userId: testUserId,
      supplierName: "Test Supplier A",
      contactPerson: "John Doe",
      email: "supplier_a@example.com",
      phone: "1234567890",
      notes: "Test supplier for performance report",
    });
    testSupplierId = testSupplier.id;

    // 创建测试物料
    await db.createMaterialItems([{
      planId: testPlanId,
      materialCode: "MAT001",
      materialName: "Test Material 001",
      materialSpec: "Spec 001",
      unitUsage: "1",
      demand: "100",
      inventory: "50",
      dailySchedule: {
        "2026-01-05": 10,
        "2026-01-06": 20,
        "2026-01-07": 30,
        "2026-01-08": 20,
        "2026-01-09": 10,
        "2026-01-10": 10,
      },
    }]);

    // 创建物料-供应商映射
    await db.createMaterialSupplierMapping({
      planId: testPlanId,
      materialCode: "MAT001",
      supplierId: testSupplierId,
      sharePercentage: 100,
    });

    // 创建供应商确认记录
    const dbInstance = await db.getDb();
    if (dbInstance) {
      await dbInstance.insert(db.supplierConfirmations).values({
        userId: testUserId,
        planId: testPlanId,
        supplierId: testSupplierId,
        confirmToken: `test_token_${Date.now()}`,
        status: "confirmed",
        dailySchedule: {
          "2026-01-05": 10,
          "2026-01-06": 20,
          "2026-01-07": 30,
          "2026-01-08": 20,
          "2026-01-09": 10,
          "2026-01-10": 10,
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    // 创建ERP实际到货记录（部分准时，部分逾期）
    await db.createActualReceipts([
      {
        userId: testUserId,
        materialCode: "MAT001",
        businessDate: "2026-01-05",
        actualQuantity: "10",
        supplierName: "Test Supplier A",
      },
      {
        userId: testUserId,
        materialCode: "MAT001",
        businessDate: "2026-01-06",
        actualQuantity: "20",
        supplierName: "Test Supplier A",
      },
      // 2026-01-07逾期，实际在2026-01-09到货
      {
        userId: testUserId,
        materialCode: "MAT001",
        businessDate: "2026-01-09",
        actualQuantity: "30",
        supplierName: "Test Supplier A",
      },
    ]);
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await db.deleteActualReceiptsByUser(testUserId);
      await db.deleteMaterialPlan(testPlanId, testUserId);
      await db.deleteSupplier(testSupplierId, testUserId);
    } catch (error) {
      console.error("清理测试数据失败:", error);
    }
  });

  it("应该正确获取供应商准时率统计", async () => {
    const stats = await db.getSupplierPerformanceStats(testUserId, testPlanId);
    
    expect(stats).toBeDefined();
    expect(stats.length).toBeGreaterThan(0);
    
    const supplierStat = stats.find((s) => s.supplierId === testSupplierId);
    expect(supplierStat).toBeDefined();
    expect(supplierStat!.supplierName).toBe("Test Supplier A");
    expect(supplierStat!.onTimeCount).toBe(2); // 2026-01-05 和 2026-01-06 准时
    expect(supplierStat!.lateCount).toBeGreaterThan(0); // 至少有一次逾期
    expect(supplierStat!.onTimeRate).toBeGreaterThan(0);
    expect(supplierStat!.onTimeRate).toBeLessThanOrEqual(100);
  });

  it("应该正确获取逾期排行榜", async () => {
    const ranking = await db.getOverdueRanking(testUserId, testPlanId);
    
    expect(ranking).toBeDefined();
    expect(ranking.length).toBeGreaterThan(0);
    
    // 验证排名字段
    ranking.forEach((item, index) => {
      expect(item.rank).toBe(index + 1);
      expect(item.supplierId).toBeDefined();
      expect(item.supplierName).toBeDefined();
      expect(item.lateCount).toBeGreaterThanOrEqual(0);
    });
    
    // 验证排序（按逾期次数降序）
    for (let i = 0; i < ranking.length - 1; i++) {
      expect(ranking[i].lateCount).toBeGreaterThanOrEqual(ranking[i + 1].lateCount);
    }
  });

  it("应该正确获取准时率趋势", async () => {
    const trend = await db.getOnTimeRateTrend(testUserId, testPlanId);
    
    expect(trend).toBeDefined();
    expect(trend.length).toBeGreaterThan(0);
    
    // 验证趋势数据结构
    trend.forEach((item) => {
      expect(item.date).toBeDefined();
      expect(item.onTimeCount).toBeGreaterThanOrEqual(0);
      expect(item.totalCount).toBeGreaterThanOrEqual(0);
      expect(item.onTimeRate).toBeGreaterThanOrEqual(0);
      expect(item.onTimeRate).toBeLessThanOrEqual(100);
    });
    
    // 验证日期排序
    const dates = trend.map((t) => t.date);
    const sortedDates = [...dates].sort();
    expect(dates).toEqual(sortedDates);
  });

  it("应该正确获取供应商交付对比数据", async () => {
    const comparison = await db.getSupplierDeliveryComparison(
      testUserId,
      testPlanId,
      testSupplierId
    );
    
    expect(comparison).toBeDefined();
    expect(comparison.supplierId).toBe(testSupplierId);
    expect(comparison.supplierName).toBe("Test Supplier A");
    expect(comparison.comparisonData).toBeDefined();
    expect(comparison.comparisonData.length).toBeGreaterThan(0);
    
    // 验证对比数据结构
    comparison.comparisonData.forEach((item) => {
      expect(item.date).toBeDefined();
      expect(item.promisedQuantity).toBeGreaterThanOrEqual(0);
      expect(item.actualQuantity).toBeGreaterThanOrEqual(0);
      expect(item.status).toMatch(/on_time|late/);
    });
    
    // 验证准时和逾期状态
    const onTimeItems = comparison.comparisonData.filter((item) => item.status === "on_time");
    const lateItems = comparison.comparisonData.filter((item) => item.status === "late");
    
    expect(onTimeItems.length).toBeGreaterThan(0); // 应该有准时的记录
    expect(lateItems.length).toBeGreaterThan(0); // 应该有逾期的记录
  });

  it("应该正确处理没有实际到货数据的情况", async () => {
    // 创建一个新的测试计划，没有实际到货数据
    const emptyPlan = await db.createMaterialPlan({
      userId: testUserId,
      fileName: "empty_plan.xlsx",
      planStartDate: "2026-02-01",
      planEndDate: "2026-02-05",
    });

    const stats = await db.getSupplierPerformanceStats(testUserId, emptyPlan.id);
    
    // 应该返回空数组或者全部为0的统计
    expect(stats).toBeDefined();
    expect(Array.isArray(stats)).toBe(true);
    
    // 清理
    const dbInstance = await db.getDb();
    if (dbInstance) {
      await dbInstance.delete(db.materialPlans).where(db.eq(db.materialPlans.id, emptyPlan.id));
    }
  });
});
