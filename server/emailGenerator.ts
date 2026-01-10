import { MaterialItem, Supplier } from "../drizzle/schema";

export interface EmailContent {
  subject: string;
  body: string;
}

interface MaterialWithSchedule extends MaterialItem {
  allocatedDemand?: number;
  sharePercentage?: string;
}

/**
 * 获取物料的日期计划
 */
function getDailySchedule(material: MaterialWithSchedule): Record<string, number> {
  if (!material.dailySchedule) return {};
  
  // dailySchedule 已经是 Record<string, number> 类型
  return material.dailySchedule;
}

/**
 * 为特定供应商生成邮件内容（表格格式）
 */
export function generateSupplierEmail(
  supplier: Supplier,
  materials: Array<MaterialWithSchedule>,
  planStartDate: string,
  planEndDate: string,
  companyName: string = "贵司"
): EmailContent {
  const month = planStartDate.split('-')[1];
  
  const subject = `【待处理】${supplier.supplierName} - ${month}月 物料来货计划详情`;
  
  let body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #000; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
    th { background-color: #fff; color: #000; padding: 8px; text-align: left; font-weight: bold; border: 1px solid #000; }
    td { padding: 8px; border: 1px solid #000; background-color: #fff; }
    .number { text-align: right; }
  </style>
</head>
<body>
  <p>尊敬的 ${supplier.contactPerson || '供应商伙伴'}：</p>
  <p>您好！</p>
  <p>根据我司最新的生产安排，现向您发送贵司负责供应的物料来货计划详情。请查收下方物料清单及各日期来货数量。</p>
  <p><strong>计划周期：</strong>${planStartDate} - ${planEndDate}</p>
  <p><strong>物料来货计划表：</strong></p>
`;
  
  // 收集所有日期
  const allDates = new Set<string>();
  for (const material of materials) {
    const schedule = getDailySchedule(material);
    Object.keys(schedule).forEach(date => allDates.add(date));
  }
  
  const sortedDates = Array.from(allDates).sort();
  
  // 如果有日期数据，生成按日期的HTML表格
  if (sortedDates.length > 0) {
    body += '<table>';
    
    // 表头
    body += '<thead><tr>';
    body += '<th>物料料号</th><th>物料名称</th><th class="number">当前库存</th><th class="number">缺口</th>';
    sortedDates.forEach(date => {
      const formattedDate = formatDateShort(date);
      body += `<th class="number">${formattedDate}</th>`;
    });
    body += '</tr></thead>';
    
    // 数据行
    body += '<tbody>';
    for (const material of materials) {
      const inventory = material.inventory ? Number(material.inventory).toFixed(0) : '0';
      const shortage = material.shortage ? Number(material.shortage).toFixed(0) : '0';
      const schedule = getDailySchedule(material);
      
      body += '<tr>';
      body += `<td>${material.materialCode}</td>`;
      body += `<td>${material.materialName}</td>`;
      body += `<td class="number">${inventory}</td>`;
      body += `<td class="number">${shortage}</td>`;
      
      sortedDates.forEach(date => {
        const qty = schedule[date] || 0;
        // 按份额分配
        const allocatedQty = material.sharePercentage 
          ? qty * (parseFloat(material.sharePercentage) / 100)
          : qty;
        body += `<td class="number">${allocatedQty > 0 ? allocatedQty.toFixed(0) : ''}</td>`;
      });
      
      body += '</tr>';
    }
    body += '</tbody></table>'
  } else {
    // 如果没有日期数据，使用简化的HTML表格
    body += '<table>';
    body += '<thead><tr>';
    body += '<th>物料料号</th><th>物料名称</th><th class="number">需求总量</th><th class="number">当前库存</th><th class="number">缺口数量</th>';
    body += '</tr></thead>';
    
    body += '<tbody>';
    for (const material of materials) {
      const totalDemand = material.demand ? Number(material.demand).toFixed(0) : '0';
      const inventory = material.inventory ? Number(material.inventory).toFixed(0) : '0';
      const shortage = material.shortage ? Number(material.shortage).toFixed(0) : '0';
      
      body += '<tr>';
      body += `<td>${material.materialCode}</td>`;
      body += `<td>${material.materialName}</td>`;
      body += `<td class="number">${totalDemand}</td>`;
      body += `<td class="number">${inventory}</td>`;
      body += `<td class="number">${shortage}</td>`;
      body += '</tr>';
    }
    body += '</tbody></table>';
  }
  
  body += `
  <p><strong>重要提示：</strong></p>
  <ol>
    <li>请在24小时内回复邮件确认收到，并告知是否能按计划执行。</li>
    <li>如对计划有任何疑问或无法满足，请在回复中详细说明原因，以便我们及时调整。</li>
    <li>请严格按照计划的到货日期安排发货，避免过早或延迟，以维持我司库存健康水平。</li>
    <li>表格中各日期列显示的是该日期需要到货的数量，请提前安排生产和物流。</li>
  </ol>
  <p>期待您的回复。感谢您的紧密配合！</p>
  <p>顺祝商祺！</p>
  <p>${companyName}<br>
  ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
</body>
</html>
`;
  
  return { subject, body };
}

/**
 * 格式化日期为简短格式（如 "1/15"）
 */
function formatDateShort(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  } catch {
    return dateStr;
  }
}

/**
 * 生成CSV格式的邮件发送清单
 */
export function generateEmailCSV(
  emailData: Array<{
    supplierName: string;
    email: string;
    subject: string;
    body: string;
  }>
): string {
  let csv = '供应商名称,邮箱,邮件主题,邮件正文\n';
  
  for (const item of emailData) {
    // CSV转义：双引号替换为两个双引号，整个字段用双引号包裹
    const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;
    
    csv += `${escape(item.supplierName)},${escape(item.email)},${escape(item.subject)},${escape(item.body)}\n`;
  }
  
  return csv;
}
