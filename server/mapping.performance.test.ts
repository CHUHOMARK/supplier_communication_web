import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Mapping Pagination API Tests', () => {
  it('should have getMaterialSupplierMappingsPaginated function', () => {
    expect(typeof db.getMaterialSupplierMappingsPaginated).toBe('function');
  });

  it('should have getMaterialSupplierMappingsByMaterialCodeFast function', () => {
    expect(typeof db.getMaterialSupplierMappingsByMaterialCodeFast).toBe('function');
  });

  it('should return paginated result with correct structure', async () => {
    const result = await db.getMaterialSupplierMappingsPaginated(1, 0, 50);
    
    expect(result).toHaveProperty('materials');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(result.page).toBe(0);
    expect(result.pageSize).toBe(50);
    expect(Array.isArray(result.materials)).toBe(true);
  });

  it('should handle pagination correctly', async () => {
    const page0 = await db.getMaterialSupplierMappingsPaginated(1, 0, 10);
    const page1 = await db.getMaterialSupplierMappingsPaginated(1, 1, 10);
    
    expect(page0.page).toBe(0);
    expect(page1.page).toBe(1);
    expect(page0.pageSize).toBe(10);
    expect(page1.pageSize).toBe(10);
  });

  it('should return empty array for non-existent user', async () => {
    const result = await db.getMaterialSupplierMappingsPaginated(999999, 0, 50);
    
    expect(result.materials).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should return empty array for non-existent material code', async () => {
    const result = await db.getMaterialSupplierMappingsByMaterialCodeFast(1, 'NON_EXISTENT_CODE');
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
