/**
 * 修改历史Excel导出器
 * 将供应商的修改历史记录导出为Excel文件
 */

export interface ModificationRecord {
  id: number;
  confirmationId: number;
  materialCode: string;
  originalSchedule: Record<string, number>;
  modifiedSchedule: Record<string, number>;
  modificationReason: string | null | undefined;
  modifiedAt: Date;
  confirmation?: {
    id: number;
    supplier?: {
      supplierName: string;
      contactPerson?: string;
      email?: string;
    };
  };
}

/**
 * 生成修改历史Excel文件
 * @param modifications 修改记录数组
 * @param supplierName 供应商名称
 * @returns Excel文件Buffer
 */
export async function generateModificationExcel(
  modifications: ModificationRecord[],
  supplierName: string
): Promise<any> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();

  // 创建摘要工作表
  const summarySheet = workbook.addWorksheet("修改摘要");
  setupSummarySheet(summarySheet, modifications, supplierName);

  // 为每个修改记录创建详细工作表
  modifications.forEach((mod, index) => {
    const sheetName = `修改${index + 1}`;
    const detailSheet = workbook.addWorksheet(sheetName);
    setupDetailSheet(detailSheet, mod, index + 1);
  });

  // 生成Excel文件
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as any;
}

/**
 * 设置摘要工作表
 */
function setupSummarySheet(
  sheet: any,
  modifications: ModificationRecord[],
  supplierName: string
) {
  // 设置列宽
  sheet.columns = [
    { header: "修改序号", key: "index", width: 12 },
    { header: "物料代码", key: "materialCode", width: 15 },
    { header: "修改时间", key: "modifiedAt", width: 20 },
    { header: "原始总量", key: "originalTotal", width: 12 },
    { header: "修改后总量", key: "modifiedTotal", width: 12 },
    { header: "总变化", key: "totalChange", width: 12 },
    { header: "修改原因", key: "reason", width: 30 },
  ];

  // 添加标题
  sheet.mergeCells("A1:G1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `${supplierName} - 修改历史摘要`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  sheet.getRow(1).height = 25;

  // 添加数据
  modifications.forEach((mod, index) => {
    const originalTotal = Object.values(mod.originalSchedule || {}).reduce(
      (a: number, b: number) => a + b,
      0
    );
    const modifiedTotal = Object.values(mod.modifiedSchedule || {}).reduce(
      (a: number, b: number) => a + b,
      0
    );
    const totalChange = modifiedTotal - originalTotal;

    sheet.addRow({
      index: index + 1,
      materialCode: mod.materialCode,
      modifiedAt: new Date(mod.modifiedAt).toLocaleString("zh-CN"),
      originalTotal,
      modifiedTotal,
      totalChange,
      reason: mod.modificationReason || "-",
    });
  });

  // 设置表头样式
  const headerRow = sheet.getRow(2);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "center" };

  // 设置数据行样式
  for (let i = 3; i <= modifications.length + 2; i++) {
    const row = sheet.getRow(i);
    row.alignment = { horizontal: "center", vertical: "center" };
    
    // 交替行颜色
    if (i % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
    }
  }

  // 设置数字格式
  for (let i = 3; i <= modifications.length + 2; i++) {
    sheet.getCell(`D${i}`).numFmt = "#,##0";
    sheet.getCell(`E${i}`).numFmt = "#,##0";
    sheet.getCell(`F${i}`).numFmt = "#,##0";
  }
}

/**
 * 设置详细工作表
 */
function setupDetailSheet(sheet: any, modification: ModificationRecord, index: number) {
  const originalSchedule = modification.originalSchedule || {};
  const modifiedSchedule = modification.modifiedSchedule || {};
  const allDates = new Set([
    ...Object.keys(originalSchedule),
    ...Object.keys(modifiedSchedule),
  ]);
  const sortedDates = Array.from(allDates).sort();

  // 设置列宽
  sheet.columns = [
    { header: "日期", key: "date", width: 15 },
    { header: "原始数量", key: "original", width: 15 },
    { header: "修改后数量", key: "modified", width: 15 },
    { header: "变化", key: "change", width: 15 },
    { header: "变化率(%)", key: "changeRate", width: 15 },
  ];

  // 添加标题
  sheet.mergeCells("A1:E1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `修改${index} - ${modification.materialCode}`;
  titleCell.font = { bold: true, size: 12 };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  sheet.getRow(1).height = 20;

  // 添加修改信息
  sheet.mergeCells("A2:E2");
  const infoCell = sheet.getCell("A2");
  infoCell.value = `修改时间：${new Date(modification.modifiedAt).toLocaleString(
    "zh-CN"
  )} | 修改原因：${modification.modificationReason || "-"}`;
  infoCell.font = { size: 10, color: { argb: "FF666666" } };
  infoCell.alignment = { horizontal: "left", vertical: "center" };
  sheet.getRow(2).height = 18;

  // 添加表头
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "center" };

  // 添加数据
  sortedDates.forEach((date) => {
    const original = originalSchedule[date] || 0;
    const modified = modifiedSchedule[date] || 0;
    const change = modified - original;
    const changeRate = original !== 0 ? ((change / original) * 100).toFixed(2) : "N/A";

    sheet.addRow({
      date,
      original,
      modified,
      change,
      changeRate,
    });
  });

  // 设置数据行样式
  for (let i = 4; i <= sortedDates.length + 3; i++) {
    const row = sheet.getRow(i);
    row.alignment = { horizontal: "center", vertical: "center" };
    
    // 交替行颜色
    if (i % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
    }

    // 设置数字格式
    sheet.getCell(`B${i}`).numFmt = "#,##0";
    sheet.getCell(`C${i}`).numFmt = "#,##0";
    sheet.getCell(`D${i}`).numFmt = "#,##0";
    sheet.getCell(`E${i}`).numFmt = "0.00";
  }

  // 添加统计行
  const statsRow = sortedDates.length + 4;
  sheet.mergeCells(`A${statsRow}:A${statsRow}`);
  const statsLabel = sheet.getCell(`A${statsRow}`);
  statsLabel.value = "合计";
  statsLabel.font = { bold: true };
  statsLabel.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE699" },
  };

  const originalTotal = Object.values(originalSchedule).reduce(
    (a: number, b: number) => a + b,
    0
  );
  const modifiedTotal = Object.values(modifiedSchedule).reduce(
    (a: number, b: number) => a + b,
    0
  );
  const totalChange = modifiedTotal - originalTotal;

  sheet.getCell(`B${statsRow}`).value = originalTotal;
  sheet.getCell(`C${statsRow}`).value = modifiedTotal;
  sheet.getCell(`D${statsRow}`).value = totalChange;

  const totalChangeRate =
    originalTotal !== 0
      ? ((totalChange / originalTotal) * 100).toFixed(2)
      : "N/A";
  sheet.getCell(`E${statsRow}`).value = totalChangeRate;

  // 设置统计行样式
  for (let col = 1; col <= 5; col++) {
    const cell = sheet.getCell(statsRow, col);
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFE699" },
    };
    cell.alignment = { horizontal: "center", vertical: "center" };
    
    if (col >= 2) {
      cell.numFmt = col === 5 ? "0.00" : "#,##0";
    }
  }
}

/**
 * 生成批量修改历史Excel文件
 * @param modificationsByConfirmation 按确认记录分组的修改记录
 * @returns Excel文件Buffer
 */
export async function generateBatchModificationExcel(
  modificationsByConfirmation: Record<number, ModificationRecord[]>
): Promise<any> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();

  // 创建总摘要工作表
  const summarySheet = workbook.addWorksheet("总摘要");
  setupBatchSummarySheet(summarySheet, modificationsByConfirmation);

  // 为每个供应商创建工作表
  Object.entries(modificationsByConfirmation).forEach(([confirmationId, mods]) => {
    if (mods.length > 0) {
      const supplierName =
        mods[0].confirmation?.supplier?.supplierName || `供应商${confirmationId}`;
      const sheetName = supplierName.substring(0, 31); // Excel工作表名称限制31个字符
      const sheet = workbook.addWorksheet(sheetName);
      setupSummarySheet(sheet, mods, supplierName);
    }
  });

  // 生成Excel文件
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as any;
}

/**
 * 设置批量摘要工作表
 */
function setupBatchSummarySheet(
  sheet: any,
  modificationsByConfirmation: Record<number, ModificationRecord[]>
) {
  // 设置列宽
  sheet.columns = [
    { header: "供应商", key: "supplier", width: 20 },
    { header: "修改次数", key: "count", width: 12 },
    { header: "物料数量", key: "materials", width: 12 },
    { header: "最后修改时间", key: "lastModified", width: 20 },
    { header: "总变化量", key: "totalChange", width: 15 },
  ];

  // 添加标题
  sheet.mergeCells("A1:E1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = "修改历史总摘要";
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "center" };
  sheet.getRow(1).height = 25;

  // 添加数据
  Object.entries(modificationsByConfirmation).forEach(([_, mods]) => {
    if (mods.length > 0) {
      const supplierName =
        mods[0].confirmation?.supplier?.supplierName || "未知供应商";
      
      // 统计物料数量
      const materials = new Set(mods.map((m) => m.materialCode)).size;
      
      // 获取最后修改时间
      const lastModified = new Date(
        Math.max(...mods.map((m) => new Date(m.modifiedAt).getTime()))
      );

      // 计算总变化量
      const totalChange = mods.reduce((sum, mod) => {
        const originalTotal = Object.values(mod.originalSchedule || {}).reduce(
          (a: number, b: number) => a + b,
          0
        );
        const modifiedTotal = Object.values(mod.modifiedSchedule || {}).reduce(
          (a: number, b: number) => a + b,
          0
        );
        return sum + (modifiedTotal - originalTotal);
      }, 0);

      sheet.addRow({
        supplier: supplierName,
        count: mods.length,
        materials,
        lastModified: lastModified.toLocaleString("zh-CN"),
        totalChange,
      });
    }
  });

  // 设置表头样式
  const headerRow = sheet.getRow(2);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "center" };

  // 设置数据行样式
  const dataRowCount = Object.keys(modificationsByConfirmation).length;
  for (let i = 3; i <= dataRowCount + 2; i++) {
    const row = sheet.getRow(i);
    row.alignment = { horizontal: "center", vertical: "center" };
    
    if (i % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" },
      };
    }
  }

  // 设置数字格式
  for (let i = 3; i <= dataRowCount + 2; i++) {
    sheet.getCell(`B${i}`).numFmt = "#,##0";
    sheet.getCell(`C${i}`).numFmt = "#,##0";
    sheet.getCell(`E${i}`).numFmt = "#,##0";
  }
}
