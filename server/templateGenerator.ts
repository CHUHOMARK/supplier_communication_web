import * as XLSX from 'xlsx';

/**
 * 生成供应商邮箱导入模板Excel文件
 * @returns Buffer containing the Excel file
 */
export function generateEmailImportTemplate(): Buffer {
  // 创建示例数据
  const data = [
    {
      '供应商名称': '苏州斯塔克电子科技有限公司',
      '邮箱': 'contact@example1.com',
      '备注': '示例数据1'
    },
    {
      '供应商名称': '河南省鹏辉电源有限公司',
      '邮箱': 'sales@example2.com',
      '备注': '示例数据2'
    },
    {
      '供应商名称': '广州擎辉储能科技有限公司',
      '邮箱': 'info@example3.com',
      '备注': '示例数据3'
    }
  ];

  // 创建工作簿
  const workbook = XLSX.utils.book_new();
  
  // 将数据转换为工作表
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 30 }, // 供应商名称
    { wch: 30 }, // 邮箱
    { wch: 20 }  // 备注
  ];

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '供应商邮箱导入模板');

  // 生成Buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  return buffer;
}

/**
 * 生成供应商映射导入模板Excel文件
 * @returns Buffer containing the Excel file
 */
export function generateMappingImportTemplate(): Buffer {
  // 创建示例数据
  const data = [
    {
      '物料代码': 'A1600719',
      '供应商名称': '苏州斯塔克电子科技有限公司',
      '联系人': '张三',
      '邮箱': 'contact@example1.com',
      '电话': '13800138000',
      '备注': '示例数据1'
    },
    {
      '物料代码': 'A1800049',
      '供应商名称': '河南省鹏辉电源有限公司',
      '联系人': '李四',
      '邮箱': 'sales@example2.com',
      '电话': '13900139000',
      '备注': '示例数据2'
    },
    {
      '物料代码': 'B2000123',
      '供应商名称': '广州擎辉储能科技有限公司',
      '联系人': '王五',
      '邮箱': 'info@example3.com',
      '电话': '13700137000',
      '备注': '示例数据3'
    }
  ];

  // 创建工作簿
  const workbook = XLSX.utils.book_new();
  
  // 将数据转换为工作表
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  worksheet['!cols'] = [
    { wch: 15 }, // 物料代码
    { wch: 30 }, // 供应商名称
    { wch: 15 }, // 联系人
    { wch: 30 }, // 邮箱
    { wch: 15 }, // 电话
    { wch: 20 }  // 备注
  ];

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(workbook, worksheet, '供应商映射导入模板');

  // 生成Buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  return buffer;
}
