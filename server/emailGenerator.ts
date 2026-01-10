import { MaterialItem, Supplier } from "../drizzle/schema";

export interface EmailContent {
  subject: string;
  body: string;
}

/**
 * 为特定供应商生成邮件内容
 */
export function generateSupplierEmail(
  supplier: Supplier,
  materials: Array<MaterialItem & { allocatedDemand?: number; sharePercentage?: string }>,
  planStartDate: string,
  planEndDate: string,
  companyName: string = "贵司"
): EmailContent {
  const month = planStartDate.split('-')[1];
  
  const subject = `【待处理】${supplier.supplierName} - ${month}月 物料来货计划详情`;
  
  let body = `尊敬的 ${supplier.contactPerson || '供应商伙伴'}：

您好！

根据我司最新的生产安排，现向您发送贵司负责供应的物料来货计划详情。请查收下方物料清单。

**计划周期：** ${planStartDate} - ${planEndDate}

**物料需求清单：**

`;
  
  // 添加物料表格
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
  
  body += `

**重要提示：**

1. 请在24小时内回复邮件确认收到，并告知是否能按计划执行。
2. 如对计划有任何疑问或无法满足，请在回复中详细说明原因，以便我们及时调整。
3. 请严格按照计划的到货日期安排发货，避免过早或延迟，以维持我司库存健康水平。

期待您的回复。感谢您的紧密配合！

顺祝商祺！

${companyName}
${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
`;
  
  return { subject, body };
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
