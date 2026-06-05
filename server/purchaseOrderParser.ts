import * as XLSX from 'xlsx';

export interface PurchaseOrderRow {
  materialCode: string;
  materialName: string;
  materialSpec: string;
  supplierName: string;
  quantity: number;
  undeliveredQuantity: number; // 未交付数量
  deliveryDate: string;
}

export interface SupplierShareCalculation {
  materialCode: string;
  materialName: string;
  suppliers: Array<{
    supplierName: string;
    totalQuantity: number;
    sharePercentage: number;
    orderCount: number;
  }>;
  totalQuantity: number;
}

/**
 * 解析采购订单Excel文件
 */
export function parsePurchaseOrderExcel(buffer: Buffer): PurchaseOrderRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // 转换为JSON，从第二行开始（第一行是标题）
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length < 2) {
    throw new Error('Excel文件格式不正确：缺少数据行');
  }
  
  // 第二行是列头
  const headers = jsonData[1] as string[];
  
  // 查找关键列的索引
  const materialCodeIndex = headers.findIndex(h => h && h.includes('料号'));
  const materialNameIndex = headers.findIndex(h => h && (h.includes('料品名称') || h.includes('物料名称')));
  const materialSpecIndex = headers.findIndex(h => h && (h.includes('料品规格') || h.includes('规格')));
  const supplierIndex = headers.findIndex(h => h && h.includes('供应商'));
  const quantityIndex = headers.findIndex(h => h && (h.includes('采购数量') || h.includes('数量')));
  const undeliveredIndex = headers.findIndex(h => h && (h.includes('未到货数量') || h.includes('未交付') || h.includes('未交货')));
  const deliveryDateIndex = headers.findIndex(h => h && (h.includes('要求交货日期') || h.includes('交货日期')));
  
  if (materialCodeIndex === -1 || supplierIndex === -1 || quantityIndex === -1) {
    throw new Error('Excel文件格式不正确：缺少必需的列（料号、供应商、采购数量）');
  }
  
  const rows: PurchaseOrderRow[] = [];
  
  // 从第三行开始解析数据
  for (let i = 2; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    const materialCode = row[materialCodeIndex];
    const supplierName = row[supplierIndex];
    const quantity = row[quantityIndex];
    
    // 跳过无效行
    if (!materialCode || !supplierName || !quantity) continue;
    
    rows.push({
      materialCode: String(materialCode).trim(),
      materialName: materialNameIndex !== -1 ? String(row[materialNameIndex] || '').trim() : '',
      materialSpec: materialSpecIndex !== -1 ? String(row[materialSpecIndex] || '').trim() : '',
      supplierName: String(supplierName).trim(),
      quantity: Number(quantity) || 0,
      undeliveredQuantity: undeliveredIndex !== -1 ? Number(row[undeliveredIndex]) || 0 : (Number(quantity) || 0),
      deliveryDate: deliveryDateIndex !== -1 ? String(row[deliveryDateIndex] || '').trim() : '',
    });
  }
  
  return rows;
}

/**
 * 根据采购订单数据计算供应商份额
 */
export function calculateSupplierShares(orders: PurchaseOrderRow[]): SupplierShareCalculation[] {
  // 按物料分组
  const materialMap = new Map<string, {
    materialName: string;
    suppliers: Map<string, { totalQuantity: number; orderCount: number }>;
  }>();
  
  for (const order of orders) {
    if (!materialMap.has(order.materialCode)) {
      materialMap.set(order.materialCode, {
        materialName: order.materialName,
        suppliers: new Map(),
      });
    }
    
    const material = materialMap.get(order.materialCode)!;
    
    if (!material.suppliers.has(order.supplierName)) {
      material.suppliers.set(order.supplierName, {
        totalQuantity: 0,
        orderCount: 0,
      });
    }
    
    const supplier = material.suppliers.get(order.supplierName)!;
    // 使用未交付数量计算份额，如果没有未交付数量则使用采购数量
    supplier.totalQuantity += order.undeliveredQuantity || order.quantity;
    supplier.orderCount += 1;
  }
  
  // 计算份额
  const calculations: SupplierShareCalculation[] = [];
  
  for (const [materialCode, material] of Array.from(materialMap.entries())) {
    const supplierValues = Array.from(material.suppliers.values()) as Array<{ totalQuantity: number; orderCount: number }>;
    const totalQuantity: number = supplierValues.reduce((sum, s) => sum + s.totalQuantity, 0);
    
    const supplierEntries = Array.from(material.suppliers.entries()) as Array<[string, { totalQuantity: number; orderCount: number }]>;
    const suppliers: Array<{
      supplierName: string;
      totalQuantity: number;
      sharePercentage: number;
      orderCount: number;
    }> = supplierEntries.map(([supplierName, data]) => ({
      supplierName,
      totalQuantity: data.totalQuantity,
      sharePercentage: totalQuantity > 0 ? (data.totalQuantity / totalQuantity) * 100 : 0,
      orderCount: data.orderCount,
    }));
    
    // 按份额降序排序
    suppliers.sort((a, b) => b.sharePercentage - a.sharePercentage);
    
    calculations.push({
      materialCode: String(materialCode),
      materialName: material.materialName,
      suppliers,
      totalQuantity: totalQuantity as number,
    });
  }
  
  // 按物料代码排序
  calculations.sort((a, b) => String(a.materialCode).localeCompare(String(b.materialCode)));
  
  return calculations;
}

/**
 * 提取唯一供应商列表
 */
export function extractUniqueSuppliers(orders: PurchaseOrderRow[]): string[] {
  const supplierSet = new Set<string>();
  
  for (const order of orders) {
    if (order.supplierName) {
      supplierSet.add(order.supplierName);
    }
  }
  
  return Array.from(supplierSet).sort((a, b) => a.localeCompare(b));
}
