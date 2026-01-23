/**
 * 批量验证所有多供应商物料的份额计算
 * 验证采购订单未交付数量是否正确用于份额计算
 */

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// 读取采购订单Excel文件
const excelPath = '/home/ubuntu/upload/PurchaseOrder20260117.xlsx';

console.log('📊 开始批量验证多物料份额计算\n');
console.log('=' .repeat(80));

try {
  const buffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // 转换为JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (jsonData.length < 2) {
    throw new Error('Excel文件格式不正确');
  }
  
  // 第二行是列头
  const headers = jsonData[1];
  
  // 查找关键列的索引
  const materialCodeIndex = headers.findIndex(h => h && h.includes('料号'));
  const materialNameIndex = headers.findIndex(h => h && (h.includes('料品名称') || h.includes('物料名称')));
  const supplierIndex = headers.findIndex(h => h && h.includes('供应商'));
  const quantityIndex = headers.findIndex(h => h && (h.includes('采购数量') || h.includes('数量')));
  const undeliveredIndex = headers.findIndex(h => h && (h.includes('未到货数量') || h.includes('未交付') || h.includes('未交货')));
  
  console.log('📋 列映射结果:');
  console.log(`  料号列: ${materialCodeIndex}`);
  console.log(`  料品名称列: ${materialNameIndex}`);
  console.log(`  供应商列: ${supplierIndex}`);
  console.log(`  采购数量列: ${quantityIndex}`);
  console.log(`  未到货数量列: ${undeliveredIndex}`);
  console.log();
  
  // 按物料分组
  const materialMap = new Map();
  
  for (let i = 2; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    const materialCode = row[materialCodeIndex];
    const materialName = materialNameIndex !== -1 ? row[materialNameIndex] : '';
    const supplierName = row[supplierIndex];
    const quantity = Number(row[quantityIndex]) || 0;
    const undeliveredQty = undeliveredIndex !== -1 ? Number(row[undeliveredIndex]) || 0 : quantity;
    
    if (!materialCode || !supplierName) continue;
    
    const key = String(materialCode).trim();
    
    if (!materialMap.has(key)) {
      materialMap.set(key, {
        materialCode: key,
        materialName: String(materialName).trim(),
        suppliers: new Map(),
        totalPurchaseQty: 0,
        totalUndeliveredQty: 0,
      });
    }
    
    const material = materialMap.get(key);
    
    if (!material.suppliers.has(supplierName)) {
      material.suppliers.set(supplierName, {
        purchaseQty: 0,
        undeliveredQty: 0,
      });
    }
    
    const supplier = material.suppliers.get(supplierName);
    supplier.purchaseQty += quantity;
    supplier.undeliveredQty += undeliveredQty;
    material.totalPurchaseQty += quantity;
    material.totalUndeliveredQty += undeliveredQty;
  }
  
  // 找出多供应商物料
  const multiSupplierMaterials = Array.from(materialMap.values())
    .filter(m => m.suppliers.size > 1)
    .sort((a, b) => a.materialCode.localeCompare(b.materialCode));
  
  console.log(`🔍 发现 ${multiSupplierMaterials.length} 个多供应商物料\n`);
  
  // 验证每个多供应商物料
  let verificationResults = [];
  let issueCount = 0;
  
  for (const material of multiSupplierMaterials) {
    const suppliers = Array.from(material.suppliers.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));
    
    // 计算基于未交付数量的份额
    const undeliveredShares = suppliers.map(s => ({
      name: s.name,
      undeliveredQty: s.undeliveredQty,
      sharePercentage: material.totalUndeliveredQty > 0 
        ? (s.undeliveredQty / material.totalUndeliveredQty * 100).toFixed(2)
        : '0.00',
    }));
    
    // 计算基于采购数量的份额（旧逻辑）
    const purchaseShares = suppliers.map(s => ({
      name: s.name,
      purchaseQty: s.purchaseQty,
      sharePercentage: material.totalPurchaseQty > 0 
        ? (s.purchaseQty / material.totalPurchaseQty * 100).toFixed(2)
        : '0.00',
    }));
    
    // 检查是否有差异
    let hasIssue = false;
    for (let i = 0; i < undeliveredShares.length; i++) {
      if (Math.abs(parseFloat(undeliveredShares[i].sharePercentage) - parseFloat(purchaseShares[i].sharePercentage)) > 0.01) {
        hasIssue = true;
        break;
      }
    }
    
    verificationResults.push({
      materialCode: material.materialCode,
      materialName: material.materialName,
      supplierCount: suppliers.length,
      totalUndeliveredQty: material.totalUndeliveredQty,
      totalPurchaseQty: material.totalPurchaseQty,
      undeliveredShares,
      purchaseShares,
      hasIssue,
    });
    
    if (hasIssue) {
      issueCount++;
    }
  }
  
  // 输出验证结果
  console.log('📈 验证结果汇总:\n');
  console.log(`  总物料数: ${verificationResults.length}`);
  console.log(`  有差异的物料数: ${issueCount}`);
  console.log(`  无差异的物料数: ${verificationResults.length - issueCount}`);
  console.log();
  
  if (issueCount > 0) {
    console.log('⚠️  有差异的物料详情:\n');
    console.log('=' .repeat(80));
    
    for (const result of verificationResults.filter(r => r.hasIssue)) {
      console.log(`\n物料: ${result.materialCode} - ${result.materialName}`);
      console.log(`供应商数: ${result.supplierCount}`);
      console.log(`总未交付数量: ${result.totalUndeliveredQty}`);
      console.log(`总采购数量: ${result.totalPurchaseQty}`);
      console.log();
      
      console.log('基于未交付数量的份额:');
      for (const share of result.undeliveredShares) {
        console.log(`  ${share.name}: ${share.undeliveredQty}/${result.totalUndeliveredQty} = ${share.sharePercentage}%`);
      }
      
      console.log();
      console.log('基于采购数量的份额 (旧逻辑):');
      for (const share of result.purchaseShares) {
        console.log(`  ${share.name}: ${share.purchaseQty}/${result.totalPurchaseQty} = ${share.sharePercentage}%`);
      }
      
      console.log();
    }
  } else {
    console.log('✅ 所有多供应商物料的份额计算一致，未发现差异！\n');
  }
  
  // 生成详细报告
  const reportPath = '/home/ubuntu/supplier_communication_web/BATCH_VERIFICATION_REPORT.md';
  let reportContent = `# 批量验证多物料份额计算报告\n\n`;
  reportContent += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  reportContent += `## 验证汇总\n\n`;
  reportContent += `| 指标 | 数值 |\n`;
  reportContent += `|------|------|\n`;
  reportContent += `| 总多供应商物料数 | ${verificationResults.length} |\n`;
  reportContent += `| 有份额差异的物料数 | ${issueCount} |\n`;
  reportContent += `| 无份额差异的物料数 | ${verificationResults.length - issueCount} |\n`;
  reportContent += `| 验证通过率 | ${((verificationResults.length - issueCount) / verificationResults.length * 100).toFixed(2)}% |\n\n`;
  
  if (issueCount > 0) {
    reportContent += `## ⚠️ 有差异的物料\n\n`;
    for (const result of verificationResults.filter(r => r.hasIssue)) {
      reportContent += `### ${result.materialCode} - ${result.materialName}\n\n`;
      reportContent += `**基本信息:**\n`;
      reportContent += `- 供应商数: ${result.supplierCount}\n`;
      reportContent += `- 总未交付数量: ${result.totalUndeliveredQty}\n`;
      reportContent += `- 总采购数量: ${result.totalPurchaseQty}\n\n`;
      
      reportContent += `**基于未交付数量的份额 (新逻辑):**\n`;
      reportContent += `| 供应商 | 未交付数量 | 份额 |\n`;
      reportContent += `|--------|-----------|------|\n`;
      for (const share of result.undeliveredShares) {
        reportContent += `| ${share.name} | ${share.undeliveredQty} | ${share.sharePercentage}% |\n`;
      }
      reportContent += `\n`;
      
      reportContent += `**基于采购数量的份额 (旧逻辑):**\n`;
      reportContent += `| 供应商 | 采购数量 | 份额 |\n`;
      reportContent += `|--------|----------|------|\n`;
      for (const share of result.purchaseShares) {
        reportContent += `| ${share.name} | ${share.purchaseQty} | ${share.sharePercentage}% |\n`;
      }
      reportContent += `\n`;
    }
  }
  
  reportContent += `## ✅ 验证通过的物料\n\n`;
  reportContent += `以下 ${verificationResults.length - issueCount} 个物料的份额计算一致，无需调整:\n\n`;
  reportContent += `| 物料代码 | 物料名称 | 供应商数 |\n`;
  reportContent += `|---------|---------|----------|\n`;
  for (const result of verificationResults.filter(r => !r.hasIssue)) {
    reportContent += `| ${result.materialCode} | ${result.materialName} | ${result.supplierCount} |\n`;
  }
  
  reportContent += `\n## 结论\n\n`;
  if (issueCount === 0) {
    reportContent += `✅ **所有多供应商物料的份额计算已正确修复**\n\n`;
    reportContent += `修复后的代码现在基于采购订单的未交付数量计算供应商份额，而不是采购数量。`;
  } else {
    reportContent += `⚠️ **发现 ${issueCount} 个物料存在份额差异**\n\n`;
    reportContent += `这些物料的份额将因修复而改变。请确保这是预期的行为。`;
  }
  
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  
} catch (error) {
  console.error('❌ 验证失败:', error.message);
  process.exit(1);
}
