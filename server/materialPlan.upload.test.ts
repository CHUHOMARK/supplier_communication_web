import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as excelParser from "./excelParser";

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

describe("materialPlan.upload", () => {
  it("successfully uploads and parses material plan", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock database functions
    const mockPlanId = 123;
    vi.spyOn(db, "createMaterialPlan").mockResolvedValue(BigInt(mockPlanId));
    vi.spyOn(db, "createMaterialItems").mockResolvedValue(undefined);

    // Mock Excel parser
    vi.spyOn(excelParser, "parseMaterialPlanExcel").mockReturnValue([
      {
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "规格1",
        demand: 100,
        inventory: 50,
      },
      {
        materialCode: "A1000002",
        materialName: "测试物料2",
        materialSpec: "规格2",
        demand: 200,
        inventory: 100,
      },
    ]);

    // Create a simple base64 string (doesn't need to be valid Excel for this test)
    const fakeExcelBase64 = Buffer.from("fake excel content").toString("base64");

    const result = await caller.materialPlan.upload({
      fileName: "test.xlsx",
      fileBase64: fakeExcelBase64,
      planStartDate: "2026-01-01",
      planEndDate: "2026-01-31",
    });

    expect(result.success).toBe(true);
    expect(result.planId).toBe(mockPlanId);
    expect(result.itemCount).toBe(2);

    // Verify database calls
    expect(db.createMaterialPlan).toHaveBeenCalledWith({
      userId: 1,
      fileName: "test.xlsx",
      planStartDate: "2026-01-01",
      planEndDate: "2026-01-31",
    });

    expect(db.createMaterialItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          planId: mockPlanId,
          materialCode: "A1000001",
          materialName: "测试物料",
        }),
        expect.objectContaining({
          planId: mockPlanId,
          materialCode: "A1000002",
          materialName: "测试物料2",
        }),
      ])
    );
  });

  it("throws error when Excel parsing fails", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Mock parser to throw error
    vi.spyOn(excelParser, "parseMaterialPlanExcel").mockImplementation(() => {
      throw new Error("Invalid Excel format");
    });

    const fakeExcelBase64 = Buffer.from("invalid content").toString("base64");

    await expect(
      caller.materialPlan.upload({
        fileName: "invalid.xlsx",
        fileBase64: fakeExcelBase64,
        planStartDate: "2026-01-01",
        planEndDate: "2026-01-31",
      })
    ).rejects.toThrow("Invalid Excel format");
  });
});

describe("supplier.create", () => {
  it("successfully creates a supplier", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockSupplierId = 456;
    vi.spyOn(db, "createSupplier").mockResolvedValue(BigInt(mockSupplierId));

    const result = await caller.supplier.create({
      supplierName: "测试供应商",
      contactPerson: "张三",
      email: "zhangsan@example.com",
      phone: "13800138000",
    });

    expect(result.supplierId).toBe(mockSupplierId);
    expect(db.createSupplier).toHaveBeenCalledWith({
      userId: 1,
      supplierName: "测试供应商",
      contactPerson: "张三",
      email: "zhangsan@example.com",
      phone: "13800138000",
    });
  });
});

describe("email.generateAll", () => {
  it("generates emails for all suppliers with mapped materials", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const mockPlanId = 1;
    const mockPlan = {
      id: mockPlanId,
      userId: 1,
      fileName: "test.xlsx",
      planStartDate: "2026-01-01",
      planEndDate: "2026-01-31",
      uploadedAt: new Date(),
    };

    const mockItems = [
      {
        id: 1,
        planId: mockPlanId,
        materialCode: "A1000001",
        materialName: "物料1",
        materialSpec: "规格1",
        unitUsage: "1",
        demand: "100",
        inventory: "50",
        shortage: "50",
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
    ];

    const mockMappings = [
      {
        id: 1,
        userId: 1,
        materialCode: "A1000001",
        supplierId: 1,
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
      planId: mockPlanId,
    });

    expect(result.success).toBe(true);
    expect(result.emailCount).toBe(1);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0]).toMatchObject({
      supplierId: 1,
      supplierName: "供应商A",
      email: "a@example.com",
      materialCount: 1,
    });

    expect(db.createGeneratedEmail).toHaveBeenCalled();
  });
});
