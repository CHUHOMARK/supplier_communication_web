import ExcelJS from 'exceljs';

interface MaterialSchedule {
  materialCode: string;
  materialName: string;
  materialSpec?: string | null;
  inventory?: string | number | null;
  shortage?: string | number | null;
  sharePercentage?: string | null;
  demand?: string | number | null;
  allocatedDemand?: number;
  [key: string]: any; // 用于日期字段
}

interface SupplierInfo {
  supplierName: string;
  contactPerson?: string | null;
  email: string | null;
}

/**
 * 生成供应商物料来货计划Excel文件
 */
export async function generateSupplierPlanExcel(
  supplier: SupplierInfo,
  materials: MaterialSchedule[],
  planStartDate: string,
  planEndDate: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('物料来货计划');

  // 收集所有日期列
  const allDates = new Set<string>();
  for (const material of materials) {
    for (const key of Object.keys(material)) {
      if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
        allDates.add(key);
      }
    }
  }
  const sortedDates = Array.from(allDates).sort();

  // 设置列宽
  worksheet.columns = [
    { width: 15 }, // 物料料号
    { width: 30 }, // 物料名称
    { width: 12 }, // 当前库存
    { width: 12 }, // 缺口
    ...sortedDates.map(() => ({ width: 12 })) // 日期列
  ];

  // 添加标题行
  worksheet.mergeCells(1, 1, 1, 4 + sortedDates.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `${supplier.supplierName} - 物料来货计划表`;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // 添加计划周期信息
  worksheet.mergeCells(2, 1, 2, 4 + sortedDates.length);
  const periodCell = worksheet.getCell(2, 1);
  periodCell.value = `计划周期：${planStartDate} 至 ${planEndDate}`;
  periodCell.font = { size: 11 };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 添加表头
  const headerRow = worksheet.getRow(3);
  const headers = ['物料料号', '物料名称', '当前库存', '缺口'];
  
  // 添加日期列表头（格式化为 月/日）
  for (const date of sortedDates) {
    const [, month, day] = date.split('-');
    headers.push(`${parseInt(month)}月${parseInt(day)}日`);
  }

  headerRow.values = headers;
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9D9D9' }
  };
  headerRow.height = 20;

  // 添加边框样式
  const borderStyle: Partial<ExcelJS.Border> = {
    style: 'thin',
    color: { argb: 'FF000000' }
  };

  // 为表头添加边框
  for (let col = 1; col <= headers.length; col++) {
    const cell = headerRow.getCell(col);
    cell.border = {
      top: borderStyle,
      left: borderStyle,
      bottom: borderStyle,
      right: borderStyle
    };
  }

  // 添加数据行
  let rowIndex = 4;
  for (const material of materials) {
    const row = worksheet.getRow(rowIndex);
    const inventory = material.inventory ? Number(material.inventory).toFixed(0) : '0';
    const shortage = material.shortage ? Number(material.shortage).toFixed(0) : '0';

    const rowData = [
      material.materialCode,
      material.materialName,
      inventory,
      shortage
    ];

    // 添加日期列数据
    for (const date of sortedDates) {
      const qty = material[date] || 0;
      // 按份额分配
      const allocatedQty = material.sharePercentage 
        ? qty * (parseFloat(material.sharePercentage) / 100)
        : qty;
      rowData.push(allocatedQty > 0 ? allocatedQty.toFixed(0) : '');
    }

    row.values = rowData;
    row.alignment = { vertical: 'middle' };
    
    // 数字列右对齐
    for (let col = 3; col <= headers.length; col++) {
      row.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' };
    }

    // 添加边框
    for (let col = 1; col <= headers.length; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: borderStyle,
        left: borderStyle,
        bottom: borderStyle,
        right: borderStyle
      };
    }

    rowIndex++;
  }

  // 添加重要提示
  const notesStartRow = rowIndex + 2;
  worksheet.mergeCells(notesStartRow, 1, notesStartRow, 4 + sortedDates.length);
  const notesCell = worksheet.getCell(notesStartRow, 1);
  notesCell.value = '重要提示：';
  notesCell.font = { bold: true, size: 11 };

  const notes = [
    '1. 请在24小时内回复邮件确认收到，并告知是否能按计划执行。',
    '2. 如对计划有任何疑问或无法满足，请在回复中详细说明原因，以便我们及时调整。',
    '3. 请严格按照计划的到货日期安排发货，避免过早或延迟，以维持我司库存健康水平。',
    '4. 表格中各日期列显示的是该日期需要到货的数量，请提前安排生产和物流。'
  ];

  for (let i = 0; i < notes.length; i++) {
    const noteRow = notesStartRow + i + 1;
    worksheet.mergeCells(noteRow, 1, noteRow, 4 + sortedDates.length);
    const noteCell = worksheet.getCell(noteRow, 1);
    noteCell.value = notes[i];
    noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  }

  // 生成Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
