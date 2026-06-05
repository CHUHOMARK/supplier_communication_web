import { describe, expect, it } from "vitest";
import { parsePurchaseOrderExcel, calculateSupplierShares, extractUniqueSuppliers } from "./purchaseOrderParser";
import * as XLSX from 'xlsx';

describe("parsePurchaseOrderExcel", () => {
  it("successfully parses purchase order Excel with correct columns", () => {
    // 创建测试Excel数据
    const data = [
      ["采购订单"], // 第一行标题
      ["业务日期", "单据编号", "供应商", "料号", "料品名称", "料品规格", "采购数量", "要求交货日期"], // 第二行列头
      ["2026-01-09", "PO001", "供应商A", "A1000001", "测试物料1", "规格1", 1000, "2026-01-15"],
      ["2026-01-09", "PO002", "供应商B", "A1000001", "测试物料1", "规格1", 500, "2026-01-15"],
      ["2026-01-10", "PO003", "供应商A", "A1000002", "测试物料2", "规格2", 2000, "2026-01-20"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "采购订单");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parsePurchaseOrderExcel(buffer);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      materialCode: "A1000001",
      materialName: "测试物料1",
      materialSpec: "规格1",
      supplierName: "供应商A",
      quantity: 1000,
    });
  });

  it("throws error when required columns are missing", () => {
    const data = [
      ["采购订单"],
      ["业务日期", "单据编号"], // 缺少必需列
      ["2026-01-09", "PO001"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "采购订单");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => parsePurchaseOrderExcel(buffer)).toThrow("缺少必需的列");
  });
});

describe("calculateSupplierShares", () => {
  it("correctly calculates supplier shares for single material", () => {
    const orders = [
      {
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "规格1",
        supplierName: "供应商A",
        quantity: 600,
        deliveryDate: "2026-01-15",
      },
      {
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "规格1",
        supplierName: "供应商B",
        quantity: 400,
        deliveryDate: "2026-01-15",
      },
    ];

    const result = calculateSupplierShares(orders);

    expect(result).toHaveLength(1);
    expect(result[0].materialCode).toBe("A1000001");
    expect(result[0].totalQuantity).toBe(1000);
    expect(result[0].suppliers).toHaveLength(2);
    
    // 供应商A应该是60%
    const supplierA = result[0].suppliers.find(s => s.supplierName === "供应商A");
    expect(supplierA?.sharePercentage).toBeCloseTo(60, 1);
    
    // 供应商B应该是40%
    const supplierB = result[0].suppliers.find(s => s.supplierName === "供应商B");
    expect(supplierB?.sharePercentage).toBeCloseTo(40, 1);
  });

  it("handles multiple materials with different suppliers", () => {
    const orders = [
      {
        materialCode: "A1000001",
        materialName: "物料1",
        materialSpec: "",
        supplierName: "供应商A",
        quantity: 1000,
        deliveryDate: "",
      },
      {
        materialCode: "A1000002",
        materialName: "物料2",
        materialSpec: "",
        supplierName: "供应商B",
        quantity: 2000,
        deliveryDate: "",
      },
    ];

    const result = calculateSupplierShares(orders);

    expect(result).toHaveLength(2);
    expect(result[0].materialCode).toBe("A1000001");
    expect(result[1].materialCode).toBe("A1000002");
  });

  it("sorts suppliers by share percentage descending", () => {
    const orders = [
      {
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "",
        supplierName: "供应商A",
        quantity: 100,
        deliveryDate: "",
      },
      {
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "",
        supplierName: "供应商B",
        quantity: 300,
        deliveryDate: "",
      },
      {
        materialCode: "A1000001",
        materialName: "测试物料",
        materialSpec: "",
        supplierName: "供应商C",
        quantity: 200,
        deliveryDate: "",
      },
    ];

    const result = calculateSupplierShares(orders);

    expect(result[0].suppliers[0].supplierName).toBe("供应商B"); // 50%
    expect(result[0].suppliers[1].supplierName).toBe("供应商C"); // 33.33%
    expect(result[0].suppliers[2].supplierName).toBe("供应商A"); // 16.67%
  });
});

describe("extractUniqueSuppliers", () => {
  it("extracts unique supplier names", () => {
    const orders = [
      {
        materialCode: "A1000001",
        materialName: "物料1",
        materialSpec: "",
        supplierName: "供应商A",
        quantity: 1000,
        deliveryDate: "",
      },
      {
        materialCode: "A1000001",
        materialName: "物料1",
        materialSpec: "",
        supplierName: "供应商B",
        quantity: 500,
        deliveryDate: "",
      },
      {
        materialCode: "A1000002",
        materialName: "物料2",
        materialSpec: "",
        supplierName: "供应商A",
        quantity: 2000,
        deliveryDate: "",
      },
    ];

    const result = extractUniqueSuppliers(orders);

    expect(result).toHaveLength(2);
    expect(result).toContain("供应商A");
    expect(result).toContain("供应商B");
  });

  it("returns sorted supplier names", () => {
    const orders = [
      {
        materialCode: "A1000001",
        materialName: "物料1",
        materialSpec: "",
        supplierName: "供应商C",
        quantity: 1000,
        deliveryDate: "",
      },
      {
        materialCode: "A1000002",
        materialName: "物料2",
        materialSpec: "",
        supplierName: "供应商A",
        quantity: 500,
        deliveryDate: "",
      },
      {
        materialCode: "A1000003",
        materialName: "物料3",
        materialSpec: "",
        supplierName: "供应商B",
        quantity: 2000,
        deliveryDate: "",
      },
    ];

    const result = extractUniqueSuppliers(orders);

    expect(result[0]).toBe("供应商A");
    expect(result[1]).toBe("供应商B");
    expect(result[2]).toBe("供应商C");
  });
});
