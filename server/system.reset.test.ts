import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('System Reset Tests', () => {
  it('should reset supplier confirmations', async () => {
    // 创建测试数据
    const token = 'test-token-' + Date.now();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.createSupplierConfirmation({
      userId: 9999,
      planId: 9999,
      supplierId: 9999,
      confirmToken: token,
      expiresAt,
      status: 'pending',
    });

    // 验证数据已创建
    const beforeReset = await db.getConfirmationByToken(token);
    expect(beforeReset).toBeDefined();

    // 执行重置
    await db.resetSupplierConfirmations();

    // 验证数据已删除
    const afterReset = await db.getConfirmationByToken(token);
    expect(afterReset).toBeNull();
  });

  it('should reset email send logs', async () => {
    // 创建测试邮件记录
    const logId = await db.createEmailSendLog({
      userId: 9999,
      planId: 9999,
      supplierId: 9999,
      recipientEmail: 'test@example.com',
      subject: 'Test',
      content: 'Test content',
      status: 'sent',
    });

    expect(logId).toBeDefined();

    // 执行重置
    await db.resetEmailSendLogs();

    // 验证数据已删除
    const logs = await db.getEmailSendLogsByPlanId(9999);
    expect(logs.length).toBe(0);
  });

  it('should reset generated emails', async () => {
    // 创建测试生成的邮件
    const emailId = await db.createGeneratedEmail({
      userId: 9999,
      planId: 9999,
      supplierId: 9999,
      emailSubject: 'Test',
      emailBody: 'Test content',
    });

    expect(emailId).toBeDefined();

    // 执行重置
    await db.resetGeneratedEmails();

    // 验证数据已删除
    const emails = await db.getGeneratedEmailsByPlanId(9999);
    expect(emails.length).toBe(0);
  });
});
