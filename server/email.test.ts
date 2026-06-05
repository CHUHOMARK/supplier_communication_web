import { describe, it, expect } from 'vitest';
import { verifyEmailService } from './emailService';

describe('Email Service', () => {
  it('should verify SMTP configuration', async () => {
    const isValid = await verifyEmailService();
    expect(isValid).toBe(true);
  }, 30000); // 30秒超时,因为SMTP验证可能需要时间
});
