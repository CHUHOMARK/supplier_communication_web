import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("mapping.upsert - multi-supplier share allocation", () => {
  it("successfully creates mappings for multiple suppliers with valid shares", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    vi.spyOn(db, "deleteMaterialSupplierMappingsByMaterialCode").mockResolvedValue(undefined);
    vi.spyOn(db, "createMaterialSupplierMapping")
      .mockResolvedValueOnce(BigInt(1))
      .mockResolvedValueOnce(BigInt(2));

    const result = await caller.mapping.upsert({
      materialCode: "A1000001",
      suppliers: [
        { supplierId: 1, sharePercentage: 60, priority: 1 },
        { supplierId: 2, sharePercentage: 40, priority: 2 },
      ],
    });

    expect(result.mappingIds).toEqual([1, 2]);
    expect(db.createMaterialSupplierMapping).toHaveBeenCalledTimes(2);
    expect(db.createMaterialSupplierMapping).toHaveBeenCalledWith({
      userId: 1,
      materialCode: "A1000001",
      supplierId: 1,
      sharePercentage: "60.00",
      priority: 1,
    });
    expect(db.createMaterialSupplierMapping).toHaveBeenCalledWith({
      userId: 1,
      materialCode: "A1000001",
      supplierId: 2,
      sharePercentage: "40.00",
      priority: 2,
    });
  });

  it("throws error when share percentages don't sum to 100", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.mapping.upsert({
        materialCode: "A1000001",
        suppliers: [
          { supplierId: 1, sharePercentage: 50, priority: 1 },
          { supplierId: 2, sharePercentage: 30, priority: 2 },
        ],
      })
    ).rejects.toThrow("供应商份额总和必须为100%");
  });

  it("accepts shares that sum to exactly 100%", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    vi.spyOn(db, "deleteMaterialSupplierMappingsByMaterialCode").mockResolvedValue(undefined);
    vi.spyOn(db, "createMaterialSupplierMapping")
      .mockResolvedValueOnce(BigInt(1))
      .mockResolvedValueOnce(BigInt(2))
      .mockResolvedValueOnce(BigInt(3));

    const result = await caller.mapping.upsert({
      materialCode: "A1000001",
      suppliers: [
        { supplierId: 1, sharePercentage: 33.33, priority: 1 },
        { supplierId: 2, sharePercentage: 33.33, priority: 2 },
        { supplierId: 3, sharePercentage: 33.34, priority: 3 },
      ],
    });

    expect(result.mappingIds).toHaveLength(3);
  });
});

describe("email.generateAll - with share allocation", () => {
  it("calculates allocated demand based on share percentage", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockPlan = {
      id: 1,
      userId: 1,
      fileName: "test.xlsx",
      planStartDate: "2026-01-01",
      planEndDate: "2026-01-31",
      uploadedAt: new Date(),
    };

    const mockItems = [
      {
        id: 1,
        planId: 1,
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "规格1",
        unitUsage: "1",
        demand: "1000", // 总需求1000
        inventory: "100",
        shortage: "900",
        inTransit: "0",
        total: "0",
        dailySchedule: null,
      },
    ];

    const mockSuppliers = [
      {
        id: 1,
        userId: 1,
        supplierName: "供应商A",
        contactPerson: "张三",
        email: "a@example.com",
        phone: "13800138000",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        supplierName: "供应商B",
        contactPerson: "李四",
        email: "b@example.com",
        phone: "13800138001",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockMappings = [
      {
        id: 1,
        userId: 1,
        materialCode: "A1000001",
        supplierId: 1,
        sharePercentage: "60.00", // 60%份额
        priority: 1,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        materialCode: "A1000001",
        supplierId: 2,
        sharePercentage: "40.00", // 40%份额
        priority: 2,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.spyOn(db, "getMaterialPlanById").mockResolvedValue(mockPlan);
    vi.spyOn(db, "getMaterialItemsByPlanId").mockResolvedValue(mockItems);
    vi.spyOn(db, "getSuppliersByUserId").mockResolvedValue(mockSuppliers);
    vi.spyOn(db, "getMaterialSupplierMappingsByUserId").mockResolvedValue(mockMappings);
    vi.spyOn(db, "deleteGeneratedEmailsByPlanId").mockResolvedValue(undefined);
    vi.spyOn(db, "createGeneratedEmail").mockResolvedValue(BigInt(1));

    const result = await caller.email.generateAll({
      planId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.emailCount).toBe(2);
    
    // 验证供应商A分配到600个（1000 * 60%）
    const emailA = result.emails.find(e => e.supplierId === 1);
    expect(emailA).toBeDefined();
    expect(emailA?.materialCount).toBe(1);

    // 验证供应商B分配到400个（1000 * 40%）
    const emailB = result.emails.find(e => e.supplierId === 2);
    expect(emailB).toBeDefined();
    expect(emailB?.materialCount).toBe(1);
  });
});
