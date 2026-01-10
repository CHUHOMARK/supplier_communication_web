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
  
  let body = `尊敬的 ${supplier.contactPerson || '供应商伙伴'}：

您好！

根据我司最新的生产安排，现向您发送贵司负责供应的物料来货计划详情。请查收下方物料清单及各日期来货数量。

**计划周期：** ${planStartDate} - ${planEndDate}

**物料来货计划表：**

`;
  
  // 收集所有日期
  const allDates = new Set<string>();
  for (const material of materials) {
    const schedule = getDailySchedule(material);
    Object.keys(schedule).forEach(date => allDates.add(date));
  }
  
  const sortedDates = Array.from(allDates).sort();
  
  // 如果有日期数据，生成按日期的表格
  if (sortedDates.length > 0) {
    // 表头
    body += '| 物料料号 | 物料名称 | 规格 | 当前库存 | 缺口 |';
    sortedDates.forEach(date => {
      const formattedDate = formatDateShort(date);
      body += ` ${formattedDate} |`;
    });
    body += ' **合计** | 份额 |\n';
    
    // 分隔线
    body += '| :--- | :--- | :--- | ---: | ---: |';
    sortedDates.forEach(() => {
      body += ' ---: |';
    });
    body += ' ---: | ---: |\n';
    
    // 数据行
    for (const material of materials) {
      const spec = material.materialSpec || '-';
      const inventory = material.inventory ? Number(material.inventory).toFixed(0) : '0';
      const shortage = material.shortage ? Number(material.shortage).toFixed(0) : '0';
      const sharePercentage = material.sharePercentage ? `${parseFloat(material.sharePercentage).toFixed(1)}%` : '100%';
      const schedule = getDailySchedule(material);
      
      body += `| ${material.materialCode} | ${material.materialName} | ${spec} | ${inventory} | ${shortage} |`;
      
      let rowTotal = 0;
      sortedDates.forEach(date => {
        const qty = schedule[date] || 0;
        // 按份额分配
        const allocatedQty = material.sharePercentage 
          ? qty * (parseFloat(material.sharePercentage) / 100)
          : qty;
        rowTotal += allocatedQty;
        body += ` ${allocatedQty > 0 ? allocatedQty.toFixed(0) : '-'} |`;
      });
      
      body += ` **${rowTotal.toFixed(0)}** | ${sharePercentage} |\n`;
    }
  } else {
    // 如果没有日期数据，使用原来的简化表格
    body += '| 物料料号 | 物料名称 | 规格 | 需求总量 | 分配数量 | 份额 | 当前库存 | 缺口数量 |\n';
    body += '| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: |\n';
    
    for (const material of materials) {
      const spec = material.materialSpec || '-';
      const totalDemand = material.demand ? Number(material.demand).toFixed(0) : '0';
      const allocatedDemand = material.allocatedDemand !== undefined ? material.allocatedDemand.toFixed(0) : totalDemand;
      const sharePercentage = material.sharePercentage ? `${parseFloat(material.sharePercentage).toFixed(1)}%` : '100%';
      const inventory = material.inventory ? Number(material.inventory).toFixed(0) : '0';
      const shortage = material.shortage ? Number(material.shortage).toFixed(0) : '0';
      
      body += `| ${material.materialCode} | ${material.materialName} | ${spec} | ${totalDemand} | **${allocatedDemand}** | ${sharePercentage} | ${inventory} | ${shortage} |\n`;
    }
  }
  
  body += `

**重要提示：**

1. 请在24小时内回复邮件确认收到，并告知是否能按计划执行。
2. 如对计划有任何疑问或无法满足，请在回复中详细说明原因，以便我们及时调整。
3. 请严格按照计划的到货日期安排发货，避免过早或延迟，以维持我司库存健康水平。
4. 表格中各日期列显示的是该日期需要到货的数量，请提前安排生产和物流。

期待您的回复。感谢您的紧密配合！

顺祝商祺！

${companyName}
${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
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
