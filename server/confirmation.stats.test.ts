import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Confirmation Stats Tests', () => {
  const testUserId = 9999;

  it('should return correct stats structure', async () => {
    const stats = await db.getConfirmationStatsByUserId(testUserId);
    
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('confirmed');
    expect(stats).toHaveProperty('partial');
    expect(stats).toHaveProperty('rejected');
    expect(stats).toHaveProperty('modified');
    
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.pending).toBe('number');
    expect(typeof stats.confirmed).toBe('number');
    expect(typeof stats.partial).toBe('number');
    expect(typeof stats.rejected).toBe('number');
    expect(typeof stats.modified).toBe('number');
  });

  it('should return zero stats for non-existent user', async () => {
    const stats = await db.getConfirmationStatsByUserId(999999);
    
    expect(stats.total).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.confirmed).toBe(0);
    expect(stats.partial).toBe(0);
    expect(stats.rejected).toBe(0);
    expect(stats.modified).toBe(0);
  });

  it('should handle null status gracefully', async () => {
    // 这个测试验证了修复后的函数能够处理null状态
    const stats = await db.getConfirmationStatsByUserId(testUserId);
    
    // 所有状态计数应该是非负数
    expect(stats.pending).toBeGreaterThanOrEqual(0);
    expect(stats.confirmed).toBeGreaterThanOrEqual(0);
    expect(stats.partial).toBeGreaterThanOrEqual(0);
    expect(stats.rejected).toBeGreaterThanOrEqual(0);
    expect(stats.modified).toBeGreaterThanOrEqual(0);
    
    // 各状态计数之和应该等于总数
    const sum = stats.pending + stats.confirmed + stats.partial + stats.rejected + stats.modified;
    expect(sum).toBe(stats.total);
  });
});
