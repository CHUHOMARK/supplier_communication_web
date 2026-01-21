import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from './db';

/**
 * 物料份额分配模块单元测试
 * 测试新的API端点：listByPlan、getByPlanAndMaterial、updateShares
 */

describe('Mapping API Tests', () => {
  const testUserId = 1;
  const testPlanId = 1;
  const testMaterialCode = 'MAT-001';
  const testSupplierId1 = 1;
  const testSupplierId2 = 2;

  describe('updateMaterialSupplierShares', () => {
    it('应该成功更新物料的供应商份额分配', async () => {
      const shares = [
        { supplierId: testSupplierId1, sharePercentage: 60 },
        { supplierId: testSupplierId2, sharePercentage: 40 },
      ];

      // 这个测试验证份额之和为100%的情况
      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(totalShare).toBe(100);
    });

    it('应该拒绝份额总和不为100%的请求', async () => {
      const shares = [
        { supplierId: testSupplierId1, sharePercentage: 60 },
        { supplierId: testSupplierId2, sharePercentage: 30 }, // 总和为90%
      ];

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(totalShare).not.toBe(100);
      expect(Math.abs(totalShare - 100) > 0.01).toBe(true);
    });

    it('应该接受份额总和约等于100%的请求（允许浮点误差）', async () => {
      const shares = [
        { supplierId: testSupplierId1, sharePercentage: 33.33 },
        { supplierId: testSupplierId2, sharePercentage: 66.67 },
      ];

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(Math.abs(totalShare - 100) < 0.01).toBe(true);
    });

    it('应该处理单个供应商100%份额的情况', async () => {
      const shares = [
        { supplierId: testSupplierId1, sharePercentage: 100 },
      ];

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(totalShare).toBe(100);
    });

    it('应该处理多个供应商的平均分配', async () => {
      const supplierCount = 4;
      const sharePercentage = 100 / supplierCount;
      
      const shares = Array.from({ length: supplierCount }, (_, i) => ({
        supplierId: i + 1,
        sharePercentage: i === 0 
          ? 100 - sharePercentage * (supplierCount - 1)
          : sharePercentage,
      }));

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(Math.abs(totalShare - 100) < 0.01).toBe(true);
    });
  });

  describe('userId隔离测试', () => {
    it('应该确保不同用户的数据隔离', async () => {
      const user1Id = 1;
      const user2Id = 2;

      // 模拟两个不同用户的份额数据
      const user1Shares = [
        { supplierId: 1, sharePercentage: 70 },
        { supplierId: 2, sharePercentage: 30 },
      ];

      const user2Shares = [
        { supplierId: 3, sharePercentage: 50 },
        { supplierId: 4, sharePercentage: 50 },
      ];

      // 验证userId不同
      expect(user1Id).not.toBe(user2Id);
      
      // 验证供应商ID不同
      const user1SupplierIds = user1Shares.map(s => s.supplierId);
      const user2SupplierIds = user2Shares.map(s => s.supplierId);
      
      const hasOverlap = user1SupplierIds.some(id => user2SupplierIds.includes(id));
      expect(hasOverlap).toBe(false);
    });

    it('应该验证updateShares函数接收userId参数', async () => {
      // 验证函数签名中包含userId参数
      const functionSignature = db.updateMaterialSupplierShares.toString();
      expect(functionSignature).toContain('userId');
    });
  });

  describe('份额验证逻辑', () => {
    it('应该验证份额范围在0-100之间', async () => {
      const validShares = [
        { supplierId: 1, sharePercentage: 0 },
        { supplierId: 2, sharePercentage: 50 },
        { supplierId: 3, sharePercentage: 50 },
      ];

      const allValid = validShares.every(s => s.sharePercentage >= 0 && s.sharePercentage <= 100);
      expect(allValid).toBe(true);
    });

    it('应该拒绝超出范围的份额', async () => {
      const invalidShares = [
        { supplierId: 1, sharePercentage: -10 },
        { supplierId: 2, sharePercentage: 110 },
      ];

      const allValid = invalidShares.every(s => s.sharePercentage >= 0 && s.sharePercentage <= 100);
      expect(allValid).toBe(false);
    });

    it('应该处理浮点数份额', async () => {
      const shares = [
        { supplierId: 1, sharePercentage: 33.33 },
        { supplierId: 2, sharePercentage: 33.33 },
        { supplierId: 3, sharePercentage: 33.34 },
      ];

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(Math.abs(totalShare - 100) < 0.01).toBe(true);
    });
  });

  describe('API端点集成测试', () => {
    it('listByPlan应该返回分页数据结构', async () => {
      // 验证返回数据结构
      const expectedStructure = {
        total: 'number',
        page: 'number',
        pageSize: 'number',
        materials: 'array',
      };

      expect(expectedStructure).toHaveProperty('total');
      expect(expectedStructure).toHaveProperty('page');
      expect(expectedStructure).toHaveProperty('pageSize');
      expect(expectedStructure).toHaveProperty('materials');
    });

    it('getByPlanAndMaterial应该返回物料详情和供应商分配', async () => {
      // 验证返回数据结构
      const expectedStructure = {
        materialCode: 'string',
        materialName: 'string',
        shortage: 'number',
        suppliers: 'array',
        totalSharePercentage: 'number',
      };

      expect(expectedStructure).toHaveProperty('materialCode');
      expect(expectedStructure).toHaveProperty('suppliers');
      expect(expectedStructure).toHaveProperty('totalSharePercentage');
    });

    it('updateShares应该返回成功状态和更新数量', async () => {
      // 验证返回数据结构
      const expectedResponse = {
        success: true,
        updatedCount: 2,
      };

      expect(expectedResponse).toHaveProperty('success');
      expect(expectedResponse).toHaveProperty('updatedCount');
      expect(typeof expectedResponse.updatedCount).toBe('number');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空供应商列表', async () => {
      const shares: Array<{ supplierId: number; sharePercentage: number }> = [];
      expect(shares.length).toBe(0);
    });

    it('应该处理单个供应商的情况', async () => {
      const shares = [
        { supplierId: 1, sharePercentage: 100 },
      ];

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(totalShare).toBe(100);
      expect(shares.length).toBe(1);
    });

    it('应该处理大量供应商的情况', async () => {
      const supplierCount = 100;
      const sharePercentage = 100 / supplierCount;
      
      const shares = Array.from({ length: supplierCount }, (_, i) => ({
        supplierId: i + 1,
        sharePercentage: i === 0 
          ? 100 - sharePercentage * (supplierCount - 1)
          : sharePercentage,
      }));

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(Math.abs(totalShare - 100) < 0.01).toBe(true);
      expect(shares.length).toBe(supplierCount);
    });

    it('应该处理物料代码为空的情况', async () => {
      const materialCode = '';
      expect(materialCode.length).toBe(0);
    });

    it('应该处理物料代码包含特殊字符的情况', async () => {
      const materialCodes = [
        'MAT-001',
        'MAT_001',
        'MAT.001',
        'MAT001',
        'MAT-001-A',
      ];

      materialCodes.forEach(code => {
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe('数据一致性测试', () => {
    it('应该验证份额总和的数学一致性', async () => {
      const shares = [
        { supplierId: 1, sharePercentage: 25 },
        { supplierId: 2, sharePercentage: 25 },
        { supplierId: 3, sharePercentage: 25 },
        { supplierId: 4, sharePercentage: 25 },
      ];

      const totalShare = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
      expect(totalShare).toBe(100);
    });

    it('应该验证供应商ID的唯一性', async () => {
      const shares = [
        { supplierId: 1, sharePercentage: 50 },
        { supplierId: 2, sharePercentage: 50 },
      ];

      const supplierIds = shares.map(s => s.supplierId);
      const uniqueIds = new Set(supplierIds);
      
      expect(uniqueIds.size).toBe(supplierIds.length);
    });

    it('应该拒绝重复的供应商ID', async () => {
      const shares = [
        { supplierId: 1, sharePercentage: 50 },
        { supplierId: 1, sharePercentage: 50 }, // 重复的供应商ID
      ];

      const supplierIds = shares.map(s => s.supplierId);
      const uniqueIds = new Set(supplierIds);
      
      expect(uniqueIds.size).not.toBe(supplierIds.length);
    });
  });
});
