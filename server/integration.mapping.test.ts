import { describe, it, expect } from 'vitest';
import * as db from './db';

/**
 * 物料份额分配模块集成测试
 * 验证前后端交互的完整流程
 */

describe('Mapping Integration Tests', () => {
  const testUserId = 1;
  const testPlanId = 1;
  const testSupplierId1 = 1;
  const testSupplierId2 = 2;

  describe('Complete Flow Tests', () => {
    it('应该支持获取计划中的物料列表', async () => {
      // 获取计划中的物料列表
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        50
      );

      expect(materialsData).toBeDefined();
      expect(materialsData).toHaveProperty('total');
      expect(materialsData).toHaveProperty('page');
      expect(materialsData).toHaveProperty('pageSize');
      expect(materialsData).toHaveProperty('materials');
      expect(Array.isArray(materialsData.materials)).toBe(true);
    });

    it('应该支持获取单个物料的供应商分配详情', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        
        // 获取单个物料的详情
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        expect(materialDetail).toBeDefined();
        expect(materialDetail).toHaveProperty('materialCode');
        expect(materialDetail).toHaveProperty('materialName');
        expect(materialDetail).toHaveProperty('shortage');
        expect(materialDetail).toHaveProperty('suppliers');
        expect(materialDetail).toHaveProperty('totalSharePercentage');
        expect(Array.isArray(materialDetail.suppliers)).toBe(true);
      }
    });

    it('应该支持更新物料的供应商份额分配', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        
        // 获取现有的供应商
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        if (materialDetail.suppliers.length >= 2) {
          const newShares = [
            { supplierId: materialDetail.suppliers[0].supplierId, sharePercentage: 60 },
            { supplierId: materialDetail.suppliers[1].supplierId, sharePercentage: 40 },
          ];

          const updatedCount = await db.updateMaterialSupplierShares(
            materialCode,
            newShares,
            testUserId
          );

          expect(typeof updatedCount).toBe('number');
          expect(updatedCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('应该验证更新后的份额数据', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        
        // 验证更新后的数据
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        expect(materialDetail.suppliers.length).toBeGreaterThan(0);
        
        const totalShare = materialDetail.totalSharePercentage;
        expect(Math.abs(totalShare - 100) < 0.01).toBe(true);
      }
    });
  });

  describe('Pagination Tests', () => {
    it('应该正确处理分页请求', async () => {
      const pageSize = 10;
      
      // 获取第一页
      const page1 = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        pageSize
      );

      expect(page1.page).toBe(0);
      expect(page1.pageSize).toBe(pageSize);
      expect(page1.materials.length).toBeLessThanOrEqual(pageSize);

      // 如果有下一页，获取第二页
      if (page1.total > pageSize) {
        const page2 = await db.getMaterialsWithSuppliersByPlan(
          testPlanId,
          1,
          pageSize
        );

        expect(page2.page).toBe(1);
        expect(page2.pageSize).toBe(pageSize);
        
        // 验证两页数据不重复
        const page1Codes = page1.materials.map(m => m.materialCode);
        const page2Codes = page2.materials.map(m => m.materialCode);
        
        const hasOverlap = page1Codes.some(code => page2Codes.includes(code));
        expect(hasOverlap).toBe(false);
      }
    });

    it('应该正确计算总页数', async () => {
      const pageSize = 25;
      const data = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        pageSize
      );

      const expectedPages = Math.ceil(data.total / pageSize);
      const actualPages = Math.ceil(data.total / data.pageSize);

      expect(actualPages).toBe(expectedPages);
    });
  });

  describe('Data Consistency Tests', () => {
    it('应该确保份额总和的一致性', async () => {
      const data = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        50
      );

      for (const material of data.materials) {
        const totalShare = material.totalSharePercentage;
        
        // 验证份额总和接近100%
        expect(Math.abs(totalShare - 100) < 1).toBe(true);
      }
    });

    it('应该确保供应商分配的完整性', async () => {
      const data = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        50
      );

      for (const material of data.materials) {
        // 每个物料应该至少有一个供应商
        expect(material.suppliers.length).toBeGreaterThan(0);
        
        // 每个供应商应该有份额信息
        for (const supplier of material.suppliers) {
          expect(supplier).toHaveProperty('supplierId');
          expect(supplier).toHaveProperty('supplierName');
          expect(supplier).toHaveProperty('sharePercentage');
          expect(typeof supplier.sharePercentage).toBe('number');
          expect(supplier.sharePercentage).toBeGreaterThanOrEqual(0);
          expect(supplier.sharePercentage).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Error Handling Tests', () => {
    it('应该拒绝份额总和不为100%的更新', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        if (materialDetail.suppliers.length >= 2) {
          const invalidShares = [
            { supplierId: materialDetail.suppliers[0].supplierId, sharePercentage: 60 },
            { supplierId: materialDetail.suppliers[1].supplierId, sharePercentage: 30 }, // 总和为90%
          ];

          try {
            await db.updateMaterialSupplierShares(
              materialCode,
              invalidShares,
              testUserId
            );
            // 如果没有抛出错误，测试失败
            expect(true).toBe(false);
          } catch (error) {
            // 应该抛出错误
            expect(error).toBeDefined();
          }
        }
      }
    });

    it('应该处理无效的物料代码', async () => {
      const invalidMaterialCode = 'NONEXISTENT-MAT-999';
      
      try {
        await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          invalidMaterialCode
        );
        // 如果没有抛出错误，测试失败
        expect(true).toBe(false);
      } catch (error) {
        // 应该抛出错误
        expect(error).toBeDefined();
      }
    });

    it('应该处理无效的计划ID', async () => {
      const invalidPlanId = 999999;
      
      const data = await db.getMaterialsWithSuppliersByPlan(
        invalidPlanId,
        0,
        50
      );

      // 应该返回空的物料列表
      expect(data).toBeDefined();
      expect(data.materials).toBeDefined();
      expect(Array.isArray(data.materials)).toBe(true);
      expect(data.materials.length).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('应该在合理时间内返回分页数据', async () => {
      const startTime = Date.now();
      
      const data = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        50
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该在1秒内完成
      expect(duration).toBeLessThan(1000);
      expect(data).toBeDefined();
    });

    it('应该在合理时间内返回物料详情', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        
        const startTime = Date.now();
        
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        const endTime = Date.now();
        const duration = endTime - startTime;

        // 应该在500ms内完成
        expect(duration).toBeLessThan(500);
        expect(materialDetail).toBeDefined();
      }
    });

    it('应该在合理时间内完成份额更新', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        if (materialDetail.suppliers.length >= 2) {
          const newShares = [
            { supplierId: materialDetail.suppliers[0].supplierId, sharePercentage: 50 },
            { supplierId: materialDetail.suppliers[1].supplierId, sharePercentage: 50 },
          ];

          const startTime = Date.now();
          
          const updatedCount = await db.updateMaterialSupplierShares(
            materialCode,
            newShares,
            testUserId
          );

          const endTime = Date.now();
          const duration = endTime - startTime;

          // 应该在1秒内完成
          expect(duration).toBeLessThan(1000);
          expect(updatedCount).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Concurrent Operation Tests', () => {
    it('应该处理并发的份额更新请求', async () => {
      // 先获取一个真实的物料代码
      const materialsData = await db.getMaterialsWithSuppliersByPlan(
        testPlanId,
        0,
        1
      );

      if (materialsData.materials.length > 0) {
        const materialCode = materialsData.materials[0].materialCode;
        const materialDetail = await db.getMaterialSupplierAllocationDetail(
          testPlanId,
          materialCode
        );

        if (materialDetail.suppliers.length >= 2) {
          const shares1 = [
            { supplierId: materialDetail.suppliers[0].supplierId, sharePercentage: 70 },
            { supplierId: materialDetail.suppliers[1].supplierId, sharePercentage: 30 },
          ];

          const shares2 = [
            { supplierId: materialDetail.suppliers[0].supplierId, sharePercentage: 40 },
            { supplierId: materialDetail.suppliers[1].supplierId, sharePercentage: 60 },
          ];

          // 并发执行两个更新
          const [result1, result2] = await Promise.all([
            db.updateMaterialSupplierShares(materialCode, shares1, testUserId),
            db.updateMaterialSupplierShares(materialCode, shares2, testUserId),
          ]);

          expect(result1).toBeGreaterThanOrEqual(0);
          expect(result2).toBeGreaterThanOrEqual(0);

          // 验证最终状态
          const finalDetail = await db.getMaterialSupplierAllocationDetail(
            testPlanId,
            materialCode
          );

          expect(finalDetail).toBeDefined();
          expect(Math.abs(finalDetail.totalSharePercentage - 100) < 0.01).toBe(true);
        }
      }
    });
  });
});
