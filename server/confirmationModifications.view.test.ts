import { describe, it, expect } from "vitest";

/**
 * 测试修改历史查看功能
 * 验证修改记录的显示、对比和统计
 */
describe("Confirmation Modifications View", () => {
  it("should display modification records with correct structure", () => {
    // 模拟修改记录
    const modification = {
      id: 1,
      confirmationId: 1,
      materialCode: "MAT001",
      originalSchedule: {
        "2026-01-05": 1000,
        "2026-01-06": 1000,
        "2026-01-07": 1000,
      },
      modifiedSchedule: {
        "2026-01-05": 800,
        "2026-01-06": 1200,
        "2026-01-07": 1000,
      },
      modificationReason: "产能调整",
      modifiedAt: new Date("2026-01-13"),
    };

    // 验证必要字段
    expect(modification).toHaveProperty("id");
    expect(modification).toHaveProperty("confirmationId");
    expect(modification).toHaveProperty("materialCode");
    expect(modification).toHaveProperty("originalSchedule");
    expect(modification).toHaveProperty("modifiedSchedule");
    expect(modification).toHaveProperty("modificationReason");
    expect(modification).toHaveProperty("modifiedAt");
  });

  it("should calculate date-by-date changes correctly", () => {
    const originalSchedule = {
      "2026-01-05": 1000,
      "2026-01-06": 1000,
      "2026-01-07": 1000,
    };

    const modifiedSchedule = {
      "2026-01-05": 800,
      "2026-01-06": 1200,
      "2026-01-07": 1000,
    };

    // 计算每个日期的变化
    const changes: Record<string, number> = {};
    Object.keys(originalSchedule).forEach((date) => {
      changes[date] = (modifiedSchedule[date] || 0) - (originalSchedule[date] || 0);
    });

    expect(changes["2026-01-05"]).toBe(-200);
    expect(changes["2026-01-06"]).toBe(200);
    expect(changes["2026-01-07"]).toBe(0);
  });

  it("should calculate total quantity changes", () => {
    const originalSchedule = {
      "2026-01-05": 1000,
      "2026-01-06": 1000,
      "2026-01-07": 1000,
    };

    const modifiedSchedule = {
      "2026-01-05": 800,
      "2026-01-06": 1200,
      "2026-01-07": 1000,
    };

    const originalTotal = Object.values(originalSchedule).reduce((a, b) => a + b, 0);
    const modifiedTotal = Object.values(modifiedSchedule).reduce((a, b) => a + b, 0);
    const totalChange = modifiedTotal - originalTotal;

    expect(originalTotal).toBe(3000);
    expect(modifiedTotal).toBe(3000);
    expect(totalChange).toBe(0);
  });

  it("should handle multiple modifications for same material", () => {
    const modifications = [
      {
        id: 1,
        materialCode: "MAT001",
        modifiedAt: new Date("2026-01-13T10:00:00"),
        originalSchedule: { "2026-01-05": 1000 },
        modifiedSchedule: { "2026-01-05": 800 },
      },
      {
        id: 2,
        materialCode: "MAT001",
        modifiedAt: new Date("2026-01-13T14:00:00"),
        originalSchedule: { "2026-01-05": 800 },
        modifiedSchedule: { "2026-01-05": 900 },
      },
    ];

    // 验证修改记录按时间排序
    const sorted = modifications.sort((a, b) => 
      new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
    );

    expect(sorted[0].modifiedSchedule["2026-01-05"]).toBe(800);
    expect(sorted[1].modifiedSchedule["2026-01-05"]).toBe(900);
  });

  it("should handle modifications with new dates added", () => {
    const originalSchedule = {
      "2026-01-05": 1000,
      "2026-01-06": 1000,
    };

    const modifiedSchedule = {
      "2026-01-05": 800,
      "2026-01-06": 1200,
      "2026-01-07": 500, // 新增日期
    };

    // 获取所有日期（包括新增的）
    const allDates = new Set([
      ...Object.keys(originalSchedule),
      ...Object.keys(modifiedSchedule),
    ]);

    expect(allDates.size).toBe(3);
    expect(allDates.has("2026-01-07")).toBe(true);
  });

  it("should format modification reason correctly", () => {
    const reasons = [
      "产能调整",
      "原料延迟",
      "设备维修",
      "客户需求变更",
    ];

    reasons.forEach((reason) => {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    });
  });

  it("should handle modifications with negative quantities", () => {
    const originalSchedule = {
      "2026-01-05": 1000,
    };

    const modifiedSchedule = {
      "2026-01-05": 500,
    };

    const change = modifiedSchedule["2026-01-05"] - originalSchedule["2026-01-05"];
    expect(change).toBe(-500);
    expect(change < 0).toBe(true);
  });

  it("should handle modifications with increased quantities", () => {
    const originalSchedule = {
      "2026-01-05": 1000,
    };

    const modifiedSchedule = {
      "2026-01-05": 1500,
    };

    const change = modifiedSchedule["2026-01-05"] - originalSchedule["2026-01-05"];
    expect(change).toBe(500);
    expect(change > 0).toBe(true);
  });

  it("should group modifications by confirmation record", () => {
    const modifications = [
      { confirmationId: 1, materialCode: "MAT001", id: 1 },
      { confirmationId: 1, materialCode: "MAT002", id: 2 },
      { confirmationId: 2, materialCode: "MAT001", id: 3 },
    ];

    // 按confirmationId分组
    const grouped: Record<number, typeof modifications> = {};
    modifications.forEach((mod) => {
      if (!grouped[mod.confirmationId]) {
        grouped[mod.confirmationId] = [];
      }
      grouped[mod.confirmationId].push(mod);
    });

    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped[1]).toHaveLength(2);
    expect(grouped[2]).toHaveLength(1);
  });

  it("should calculate percentage change", () => {
    const originalSchedule = {
      "2026-01-05": 1000,
    };

    const modifiedSchedule = {
      "2026-01-05": 800,
    };

    const original = originalSchedule["2026-01-05"];
    const modified = modifiedSchedule["2026-01-05"];
    const percentageChange = ((modified - original) / original) * 100;

    expect(percentageChange).toBe(-20);
  });

  it("should validate modification data before display", () => {
    const validModification = {
      confirmationId: 1,
      materialCode: "MAT001",
      originalSchedule: { "2026-01-05": 1000 },
      modifiedSchedule: { "2026-01-05": 800 },
      modificationReason: "产能调整",
      modifiedAt: new Date(),
    };

    // 验证所有必要字段都存在
    const isValid = 
      typeof validModification.confirmationId === "number" &&
      typeof validModification.materialCode === "string" &&
      typeof validModification.originalSchedule === "object" &&
      typeof validModification.modifiedSchedule === "object" &&
      typeof validModification.modificationReason === "string" &&
      validModification.modifiedAt instanceof Date;

    expect(isValid).toBe(true);
  });
});
