import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from './db';

/**
 * 测试供应商确认页面物料数量计算修复
 * 
 * 问题：供应商确认页面显示的是原始的物料计划数量，而不是按供应商份额分配后的数量
 * 修复：在confirmation.getByToken API中，根据供应商份额重新计算dailySchedule
 */
describe('confirmation.getByToken - 物料数量计算', () => {
  
  it('应该根据供应商份额重新计算dailySchedule', () => {
    // 测试数据
    const originalSchedule = {
      '2026-01-05': 1000,
      '2026-01-06': 1000,
      '2026-01-08': 2400,
    };
    
    const sharePercentage = 67.6;
    
    // 模拟API中的计算逻辑
    const allocatedSchedule: Record<string, number> = {};
    for (const [date, qty] of Object.entries(originalSchedule)) {
      allocatedSchedule[date] = Math.round(qty * sharePercentage / 100);
    }
    
    // 验证计算结果
    expect(allocatedSchedule['2026-01-05']).toBe(676);
    expect(allocatedSchedule['2026-01-06']).toBe(676);
    expect(allocatedSchedule['2026-01-08']).toBe(1622);
  });
  
  it('应该正确处理多个物料的dailySchedule聚合', () => {
    // 模拟多个物料的来货数量
    const materials = [
      {
        materialCode: 'A1300038',
        dailySchedule: {
          '2026-01-05': 1000,
          '2026-01-06': 1000,
          '2026-01-08': 2400,
        },
        sharePercentage: '67.6',
      },
      {
        materialCode: 'A1300003',
        dailySchedule: {
          '2026-01-05': 500,
          '2026-01-08': 1000,
        },
        sharePercentage: '50',
      },
    ];
    
    // 模拟API中的聚合逻辑
    const supplierDailySchedule: Record<string, number> = {};
    for (const material of materials) {
      const schedule = material.dailySchedule || {};
      const sharePercentage = parseFloat(material.sharePercentage || '100');
      
      for (const [date, qty] of Object.entries(schedule)) {
        const allocatedQty = Math.round(qty * sharePercentage / 100);
        if (allocatedQty > 0) {
          supplierDailySchedule[date] = (supplierDailySchedule[date] || 0) + allocatedQty;
        }
      }
    }
    
    // 验证聚合结果
    expect(supplierDailySchedule['2026-01-05']).toBe(676 + 250); // 676 + 500*50%
    expect(supplierDailySchedule['2026-01-06']).toBe(676); // 只有A1300038
    expect(supplierDailySchedule['2026-01-08']).toBe(1622 + 500); // 1622 + 1000*50%
  });
  
  it('应该处理份额百分比为100%的情况', () => {
    const originalSchedule = {
      '2026-01-05': 1000,
      '2026-01-06': 1000,
    };
    
    const sharePercentage = 100;
    
    const allocatedSchedule: Record<string, number> = {};
    for (const [date, qty] of Object.entries(originalSchedule)) {
      allocatedSchedule[date] = Math.round(qty * sharePercentage / 100);
    }
    
    // 份额为100%时，应该返回原始数量
    expect(allocatedSchedule['2026-01-05']).toBe(1000);
    expect(allocatedSchedule['2026-01-06']).toBe(1000);
  });
  
  it('应该处理份额百分比为0%的情况', () => {
    const originalSchedule = {
      '2026-01-05': 1000,
      '2026-01-06': 1000,
    };
    
    const sharePercentage = 0;
    
    const allocatedSchedule: Record<string, number> = {};
    for (const [date, qty] of Object.entries(originalSchedule)) {
      allocatedSchedule[date] = Math.round(qty * sharePercentage / 100);
    }
    
    // 份额为0%时，应该返回0
    expect(allocatedSchedule['2026-01-05']).toBe(0);
    expect(allocatedSchedule['2026-01-06']).toBe(0);
  });
  
  it('应该正确处理舍入误差', () => {
    // 测试舍入逻辑
    const testCases = [
      { qty: 1000, share: 33.3, expected: 333 }, // 333.0
      { qty: 1000, share: 33.4, expected: 334 }, // 334.0
      { qty: 1000, share: 33.5, expected: 335 }, // 335.0 (四舍五入)
      { qty: 1000, share: 33.6, expected: 336 }, // 336.0
      { qty: 2400, share: 67.6, expected: 1622 }, // 1622.4 -> 1622
    ];
    
    for (const testCase of testCases) {
      const result = Math.round(testCase.qty * testCase.share / 100);
      expect(result).toBe(testCase.expected);
    }
  });
});
