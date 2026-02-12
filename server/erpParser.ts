import ExcelJS from "exceljs";

/**
 * ERP实际到货记录接口
 */
export interface ActualReceiptData {
  materialCode: string;
  businessDate: string; // YYYY-MM-DD格式
  actualQuantity: number;
  supplierName?: string;
}

/**
 * 解析ERP实际到货Excel文件
 * 
 * 期望的Excel格式：
 * - 包含表头行，列名包括：'业务日期'、'料号'、'实收数量(计价单位)'
 * - 可选列：'供应商名称'
 * 
 * @param fileContent Base64编码的Excel文件内容
 * @returns 解析后的到货记录数组
 */
export async function parseActualReceiptExcel(fileContent: string): Promise<ActualReceiptData[]> {
  try {
    // 解码Base64内容
    const buffer = Buffer.from(fileContent, "base64") as any;
    
    // 创建工作簿并加载Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    // 获取第一个工作表
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Excel文件中没有找到工作表");
    }
    
    // 查找表头行
    let headerRow: ExcelJS.Row | null = null;
    let headerRowIndex = 0;
    
    for (let i = 1; i <= Math.min(20, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      const firstCellValue = row.getCell(1).value?.toString() || "";
      
      // 查找包含"业务日期"或"料号"的行作为表头
      if (firstCellValue.includes("业务日期") || firstCellValue.includes("料号")) {
        headerRow = row;
        headerRowIndex = i;
        break;
      }
    }
    
    if (!headerRow) {
      throw new Error("未找到表头行，请确保Excel包含'业务日期'、'料号'、'实收数量(计价单位)'列");
    }
    
    // 解析表头，找到各列的索引
    const headerMap: { [key: string]: number } = {};
    headerRow.eachCell((cell, colNumber) => {
      const cellValue = cell.value?.toString().trim() || "";
      headerMap[cellValue] = colNumber;
    });
    
    // 验证必需的列是否存在
    const requiredColumns = ["业务日期", "料号", "实收数量(计价单位)"];
    const missingColumns = requiredColumns.filter(col => !headerMap[col]);
    
    if (missingColumns.length > 0) {
      throw new Error(`缺少必需的列：${missingColumns.join(", ")}`);
    }
    
    // 解析数据行
    const receipts: ActualReceiptData[] = [];
    
    for (let i = headerRowIndex + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      // 跳过空行
      if (row.cellCount === 0 || !row.getCell(1).value) {
        continue;
      }
      
      try {
        // 提取料号
        const materialCode = row.getCell(headerMap["料号"]).value?.toString().trim() || "";
        if (!materialCode) {
          console.warn(`第${i}行：料号为空，跳过`);
          continue;
        }
        
        // 提取业务日期
        const businessDateCell = row.getCell(headerMap["业务日期"]);
        let businessDate = "";
        
        if (businessDateCell.value instanceof Date) {
          // 如果是Date对象，格式化为YYYY-MM-DD
          const date = businessDateCell.value;
          businessDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        } else {
          // 如果是字符串，尝试解析
          const dateStr = businessDateCell.value?.toString().trim() || "";
          if (dateStr) {
            // 尝试解析常见的日期格式
            const dateMatch = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (dateMatch) {
              const [, year, month, day] = dateMatch;
              businessDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            } else {
              console.warn(`第${i}行：无法解析业务日期"${dateStr}"，跳过`);
              continue;
            }
          } else {
            console.warn(`第${i}行：业务日期为空，跳过`);
            continue;
          }
        }
        
        // 提取实收数量
        const actualQuantityCell = row.getCell(headerMap["实收数量(计价单位)"]);
        const actualQuantityValue = actualQuantityCell.value;
        let actualQuantity = 0;
        
        if (typeof actualQuantityValue === "number") {
          actualQuantity = actualQuantityValue;
        } else if (typeof actualQuantityValue === "string") {
          actualQuantity = parseFloat(actualQuantityValue.replace(/,/g, ""));
        } else {
          console.warn(`第${i}行：实收数量格式错误，跳过`);
          continue;
        }
        
        if (isNaN(actualQuantity) || actualQuantity < 0) {
          console.warn(`第${i}行：实收数量无效(${actualQuantityValue})，跳过`);
          continue;
        }
        
        // 提取供应商名称（可选）
        let supplierName: string | undefined;
        if (headerMap["供应商名称"]) {
          supplierName = row.getCell(headerMap["供应商名称"]).value?.toString().trim();
        }
        
        receipts.push({
          materialCode,
          businessDate,
          actualQuantity,
          supplierName,
        });
      } catch (error) {
        console.error(`解析第${i}行时出错:`, error);
        // 继续处理下一行
      }
    }
    
    if (receipts.length === 0) {
      throw new Error("Excel文件中没有找到有效的数据行");
    }
    
    return receipts;
  } catch (error) {
    console.error("解析ERP到货Excel失败:", error);
    throw error;
  }
}
