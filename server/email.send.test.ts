import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';

describe('Email Send Functionality Tests', () => {
  const testUserId = 999;
  const testPlanId = 999;
  const testSupplierId = 999;

  it('should create email send log correctly', async () => {
    const logId = await db.createEmailSendLog({
      userId: testUserId,
      planId: testPlanId,
      supplierId: testSupplierId,
      recipientEmail: 'test@example.com',
      subject: 'Test Subject',
      content: 'Test Content',
      status: 'pending',
    });

    expect(logId).toBeDefined();
    expect(Number(logId)).toBeGreaterThan(0);
  });

  it('should update email send log status', async () => {
    const logId = await db.createEmailSendLog({
      userId: testUserId,
      planId: testPlanId,
      supplierId: testSupplierId,
      recipientEmail: 'test@example.com',
      subject: 'Test Subject',
      content: 'Test Content',
      status: 'pending',
    });

    await db.updateEmailSendLogStatus(Number(logId), 'sent', undefined);

    const logs = await db.getEmailSendLogsByPlanId(testPlanId);
    const updatedLog = logs.find(log => log.id === Number(logId));
    
    expect(updatedLog).toBeDefined();
    expect(updatedLog?.status).toBe('sent');
  });

  it('should retrieve email send logs by plan id', async () => {
    const logId = await db.createEmailSendLog({
      userId: testUserId,
      planId: testPlanId,
      supplierId: testSupplierId,
      recipientEmail: 'test@example.com',
      subject: 'Test Subject',
      content: 'Test Content',
      status: 'pending',
    });

    const logs = await db.getEmailSendLogsByPlanId(testPlanId);
    
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some(log => log.id === Number(logId))).toBe(true);
  });

  it('should handle email send log with error message', async () => {
    const errorMessage = 'SMTP connection failed';
    const logId = await db.createEmailSendLog({
      userId: testUserId,
      planId: testPlanId,
      supplierId: testSupplierId,
      recipientEmail: 'test@example.com',
      subject: 'Test Subject',
      content: 'Test Content',
      status: 'pending',
    });

    await db.updateEmailSendLogStatus(Number(logId), 'failed', errorMessage);

    const logs = await db.getEmailSendLogsByPlanId(testPlanId);
    const failedLog = logs.find(log => log.id === Number(logId));
    
    expect(failedLog?.status).toBe('failed');
    expect(failedLog?.errorMessage).toBe(errorMessage);
  });

  afterAll(async () => {
    // 清理测试数据
    const logs = await db.getEmailSendLogsByPlanId(testPlanId);
    for (const log of logs) {
      if (log.userId === testUserId) {
        // 无法直接删除，但测试数据会在数据库中保留
      }
    }
  });
});
