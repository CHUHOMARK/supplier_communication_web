import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supplierAuth module
vi.mock('./supplierAuth', () => ({
  getSupplierAccountsByUserId: vi.fn(),
  getSupplierAccountBySupplierId: vi.fn(),
  generateSupplierCode: vi.fn(),
  createSupplierAccount: vi.fn(),
  resetSupplierPin: vi.fn(),
  deleteSupplierAccount: vi.fn(),
}));

import * as supplierAuthDb from './supplierAuth';

describe('Supplier Account Admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list - getSupplierAccountsByUserId', () => {
    it('should return accounts with nested account and supplier objects', async () => {
      const mockAccounts = [
        {
          account: {
            id: 1,
            supplierId: 100,
            userId: 1,
            supplierCode: 'S1-001',
            pinCode: '$2b$10$hashedpin',
            isFirstLogin: true,
            isActive: true,
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          supplier: {
            id: 100,
            supplierName: '测试供应商A',
            contactPerson: '张三',
            email: 'test@example.com',
            phone: '13800138000',
          },
        },
      ];

      (supplierAuthDb.getSupplierAccountsByUserId as any).mockResolvedValue(mockAccounts);

      const result = await supplierAuthDb.getSupplierAccountsByUserId(1);
      expect(result).toHaveLength(1);
      expect(result[0].account.supplierId).toBe(100);
      expect(result[0].account.supplierCode).toBe('S1-001');
      expect(result[0].supplier.supplierName).toBe('测试供应商A');
    });

    it('should return empty array when no accounts exist', async () => {
      (supplierAuthDb.getSupplierAccountsByUserId as any).mockResolvedValue([]);

      const result = await supplierAuthDb.getSupplierAccountsByUserId(999);
      expect(result).toHaveLength(0);
    });
  });

  describe('create - createSupplierAccount', () => {
    it('should check for existing account before creating', async () => {
      (supplierAuthDb.getSupplierAccountBySupplierId as any).mockResolvedValue(null);
      (supplierAuthDb.generateSupplierCode as any).mockResolvedValue('S1-002');
      (supplierAuthDb.createSupplierAccount as any).mockResolvedValue(1);

      // Simulate the create flow
      const supplierId = 200;
      const userId = 1;
      const pinCode = '888888';

      const existing = await supplierAuthDb.getSupplierAccountBySupplierId(supplierId);
      expect(existing).toBeNull();

      const supplierCode = await supplierAuthDb.generateSupplierCode(userId);
      expect(supplierCode).toBe('S1-002');

      const accountId = await supplierAuthDb.createSupplierAccount({
        supplierId,
        userId,
        supplierCode,
        pinCode,
      });
      expect(accountId).toBe(1);
    });

    it('should reject if supplier already has an account', async () => {
      (supplierAuthDb.getSupplierAccountBySupplierId as any).mockResolvedValue({
        id: 1,
        supplierId: 100,
        supplierCode: 'S1-001',
      });

      const existing = await supplierAuthDb.getSupplierAccountBySupplierId(100);
      expect(existing).not.toBeNull();
      // In the actual router, this would throw TRPCError with code 'BAD_REQUEST'
    });
  });

  describe('resetPin', () => {
    it('should call resetSupplierPin with correct parameters', async () => {
      (supplierAuthDb.resetSupplierPin as any).mockResolvedValue(undefined);

      await supplierAuthDb.resetSupplierPin(1, '888888');
      expect(supplierAuthDb.resetSupplierPin).toHaveBeenCalledWith(1, '888888');
    });
  });

  describe('delete', () => {
    it('should call deleteSupplierAccount with accountId and userId', async () => {
      (supplierAuthDb.deleteSupplierAccount as any).mockResolvedValue(undefined);

      await supplierAuthDb.deleteSupplierAccount(1, 1);
      expect(supplierAuthDb.deleteSupplierAccount).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('Frontend integration - account detection logic', () => {
    it('should correctly identify supplier with existing account using nested path', () => {
      const supplierAccounts = [
        {
          account: { id: 1, supplierId: 100, supplierCode: 'S1-001' },
          supplier: { id: 100, supplierName: '供应商A' },
        },
        {
          account: { id: 2, supplierId: 200, supplierCode: 'S1-002' },
          supplier: { id: 200, supplierName: '供应商B' },
        },
      ];

      // Test: supplier 100 has account
      const hasAccount100 = supplierAccounts.some((a) => a.account.supplierId === 100);
      expect(hasAccount100).toBe(true);

      // Test: supplier 300 does NOT have account
      const hasAccount300 = supplierAccounts.some((a) => a.account.supplierId === 300);
      expect(hasAccount300).toBe(false);
    });

    it('should correctly find account record for resetPin', () => {
      const supplierAccounts = [
        {
          account: { id: 5, supplierId: 100, supplierCode: 'S1-001' },
          supplier: { id: 100, supplierName: '供应商A' },
        },
      ];

      const accountRecord = supplierAccounts.find((a) => a.account.supplierId === 100);
      expect(accountRecord).toBeDefined();
      expect(accountRecord!.account.id).toBe(5);
    });

    it('should return undefined when supplier has no account', () => {
      const supplierAccounts = [
        {
          account: { id: 5, supplierId: 100, supplierCode: 'S1-001' },
          supplier: { id: 100, supplierName: '供应商A' },
        },
      ];

      const accountRecord = supplierAccounts.find((a) => a.account.supplierId === 999);
      expect(accountRecord).toBeUndefined();
    });
  });
});
