import * as XLSX from 'xlsx';

export interface ParsedMaterialItem {
  materialCode: string;
  materialName: string;
  materialSpec?: string;
  unitUsage?: number;
  demand?: number;
  inventory?: number;
  shortage?: number;
  inTransit?: number;
  total?: number;
  dailySchedule?: Record<string, number>;
}

export interface ParsedSupplierMapping {
  materialCode: string;
  materialName?: string;
  materialSpec?: string;
  supplierName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

/**
 * 解析物料计划Excel文件
 */
export function parseMaterialPlanExcel(buffer: Buffer): ParsedMaterialItem[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // 查找物料计划表sheet（可能有不同的命名）
  let sheetName = workbook.SheetNames.find(name => 
    name.includes('物料计划') || name.includes('计划更新')
  );
  
  if (!sheetName) {
    sheetName = workbook.SheetNames[0]; // 默认使用第一个sheet
  }
  
  const worksheet = workbook.Sheets[sheetName];
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (jsonData.length < 2) {
    throw new Error('Excel文件格式不正确：数据行不足');
  }
  
  // 查找列索引
  const headerRow = jsonData[0] as any[];
  const findColumnIndex = (keywords: string[]) => {
    return headerRow.findIndex((cell: any) => 
      keywords.some(keyword => String(cell || '').includes(keyword))
    );
  };
  
  const codeIdx = findColumnIndex(['料号', '子件料号']);
  const nameIdx = findColumnIndex(['名称', '子件名称']);
  const specIdx = findColumnIndex(['规格', '子件规格']);
  const usageIdx = findColumnIndex(['用量', '子件用量']);
  const demandIdx = findColumnIndex(['需求']);
  const inventoryIdx = findColumnIndex(['库存']);
  const shortageIdx = findColumnIndex(['缺数']);
  const inTransitIdx = findColumnIndex(['在途']);
  const totalIdx = findColumnIndex(['合计']);
  
  if (codeIdx === -1 || nameIdx === -1) {
    throw new Error('Excel文件格式不正确：缺少必要的列（料号、名称）');
  }
  
  const items: ParsedMaterialItem[] = [];
  
  // 从第3行开始解析数据（跳过标题行和日期行）
  for (let i = 2; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    
    const materialCode = row[codeIdx];
    const materialName = row[nameIdx];
    
    // 跳过空行
    if (!materialCode || !materialName) continue;
    
    const item: ParsedMaterialItem = {
      materialCode: String(materialCode),
      materialName: String(materialName),
      materialSpec: specIdx !== -1 && row[specIdx] ? String(row[specIdx]) : undefined,
      unitUsage: usageIdx !== -1 ? parseFloat(row[usageIdx]) || undefined : undefined,
      demand: demandIdx !== -1 ? parseFloat(row[demandIdx]) || undefined : undefined,
      inventory: inventoryIdx !== -1 ? parseFloat(row[inventoryIdx]) || undefined : undefined,
      shortage: shortageIdx !== -1 ? parseFloat(row[shortageIdx]) || undefined : undefined,
      inTransit: inTransitIdx !== -1 ? parseFloat(row[inTransitIdx]) || undefined : undefined,
      total: totalIdx !== -1 ? parseFloat(row[totalIdx]) || undefined : undefined,
    };
    
    // 解析每日到货计划（从合计列之后的列）
    const dailySchedule: Record<string, number> = {};
    if (totalIdx !== -1) {
      for (let j = totalIdx + 1; j < row.length; j++) {
        const value = parseFloat(row[j]);
        if (!isNaN(value) && value > 0) {
          // 使用列索引作为临时键，实际日期需要从第二行获取
          const dateCell = jsonData[1][j];
          if (dateCell) {
            // Excel日期转换
            const date = excelDateToJSDate(dateCell);
            if (date) {
              dailySchedule[date] = value;
            }
          }
        }
      }
    }
    
    if (Object.keys(dailySchedule).length > 0) {
      item.dailySchedule = dailySchedule;
    }
    
    items.push(item);
  }
  
  return items;
}

/**
 * 解析供应商映射Excel文件
 */
export function parseSupplierMappingExcel(buffer: Buffer): ParsedSupplierMapping[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (jsonData.length < 2) {
    throw new Error('Excel文件格式不正确：数据行不足');
  }
  
  const headerRow = jsonData[0] as any[];
  const findColumnIndex = (keywords: string[]) => {
    return headerRow.findIndex((cell: any) => 
      keywords.some(keyword => String(cell || '').includes(keyword))
    );
  };
  
  const codeIdx = findColumnIndex(['料号', '子件料号']);
  const nameIdx = findColumnIndex(['名称', '子件名称', '物料名称']);
  const specIdx = findColumnIndex(['规格', '子件规格']);
  const supplierIdx = findColumnIndex(['供应商']);
  const contactIdx = findColumnIndex(['联系人']);
  const emailIdx = findColumnIndex(['邮箱', 'email']);
  const phoneIdx = findColumnIndex(['电话', '手机']);
  const notesIdx = findColumnIndex(['备注']);
  
  if (codeIdx === -1 || supplierIdx === -1) {
    throw new Error('Excel文件格式不正确：缺少必要的列（料号、供应商名称）');
  }
  
  const mappings: ParsedSupplierMapping[] = [];
  
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[];
    
    const materialCode = row[codeIdx];
    const supplierName = row[supplierIdx];
    
    if (!materialCode || !supplierName) continue;
    
    mappings.push({
      materialCode: String(materialCode),
      materialName: nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]) : undefined,
      materialSpec: specIdx !== -1 && row[specIdx] ? String(row[specIdx]) : undefined,
      supplierName: String(supplierName),
      contactPerson: contactIdx !== -1 && row[contactIdx] ? String(row[contactIdx]) : undefined,
      email: emailIdx !== -1 && row[emailIdx] ? String(row[emailIdx]) : undefined,
      phone: phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]) : undefined,
      notes: notesIdx !== -1 && row[notesIdx] ? String(row[notesIdx]) : undefined,
    });
  }
  
  return mappings;
}

/**
 * Excel日期转换为JS日期字符串
 */
function excelDateToJSDate(excelDate: any): string | null {
  if (typeof excelDate === 'number') {
    // Excel日期从1900-01-01开始计算
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  return null;
}
