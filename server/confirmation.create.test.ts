import { describe, it, expect } from 'vitest';
import * as db from './db';
import { generateConfirmToken, calculateExpiryDate } from './confirmationService';

describe('Confirmation Record Creation Tests', () => {
  const testUserId = 9998;
  const testPlanId = 9998;
  const testSupplierId = 9998;

  it('should create confirmation record with pending status', async () => {
    const token = generateConfirmToken();
    const expiresAt = calculateExpiryDate(30);

    const confirmationId = await db.createSupplierConfirmation({
      userId: testUserId,
      planId: testPlanId,
      supplierId: testSupplierId,
      confirmToken: token,
      expiresAt,
      status: 'pending',
    });

    expect(confirmationId).toBeDefined();
    expect(Number(confirmationId)).toBeGreaterThan(0);

    // 验证创建的记录
    const confirmation = await db.getConfirmationByToken(token);
    expect(confirmation).toBeDefined();
    expect(confirmation?.status).toBe('pending');
    expect(confirmation?.userId).toBe(testUserId);
    expect(confirmation?.planId).toBe(testPlanId);
    expect(confirmation?.supplierId).toBe(testSupplierId);
  });

  it('should handle confirmation creation without explicit status', async () => {
    const token = generateConfirmToken();
    const expiresAt = calculateExpiryDate(30);

    const confirmationId = await db.createSupplierConfirmation({
      userId: testUserId,
      planId: testPlanId + 1,
      supplierId: testSupplierId + 1,
      confirmToken: token,
      expiresAt,
    });

    expect(confirmationId).toBeDefined();

    // 验证创建的记录，即使没有显式指定status，也应该有默认值
    const confirmation = await db.getConfirmationByToken(token);
    expect(confirmation).toBeDefined();
    expect(confirmation?.status).toBeTruthy(); // 应该有某个值
  });

  it('should include confirmation in stats after creation', async () => {
    const token = generateConfirmToken();
    const expiresAt = calculateExpiryDate(30);

    const confirmationId = await db.createSupplierConfirmation({
      userId: testUserId,
      planId: testPlanId + 2,
      supplierId: testSupplierId + 2,
      confirmToken: token,
      expiresAt,
      status: 'pending',
    });

    // 获取统计信息
    const stats = await db.getConfirmationStatsByUserId(testUserId);

    // 验证新创建的确认记录被计入统计
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.pending).toBeGreaterThan(0);
  });
});
