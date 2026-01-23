import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function analyzeShareIssue() {
  const conn = await pool.getConnection();
  
  try {
    // 查询A1300003的采购订单数据
    const [poData] = await conn.query(`
      SELECT supplierName, SUM(undeliveredQuantity) as total_undelivered
      FROM purchase_orders
      WHERE materialCode = 'A1300003'
      GROUP BY supplierName
    `);
    
    console.log('\n=== A1300003 采购订单未交付数量 ===');
    let totalUndelivered = 0;
    poData.forEach(row => {
      console.log(`${row.supplierName}: ${row.total_undelivered}`);
      totalUndelivered += row.total_undelivered;
    });
    console.log(`总计: ${totalUndelivered}`);
    
    // 查询A1300003的供应商份额
    const [shareData] = await conn.query(`
      SELECT msm.supplierId, s.supplierName, msm.sharePercentage
      FROM material_supplier_mappings msm
      JOIN suppliers s ON msm.supplierId = s.id
      WHERE msm.materialCode = 'A1300003'
      ORDER BY s.supplierName
    `);
    
    console.log('\n=== A1300003 供应商份额 ===');
    let totalShare = 0;
    shareData.forEach(row => {
      const share = parseFloat(row.sharePercentage);
      console.log(`${row.supplierName}: ${share}%`);
      totalShare += share;
    });
    console.log(`总计: ${totalShare}%`);
    
    // 计算应该的份额
    console.log('\n=== 根据采购订单计算的应该份额 ===');
    poData.forEach(row => {
      const percentage = (row.total_undelivered / totalUndelivered * 100).toFixed(2);
      console.log(`${row.supplierName}: ${row.total_undelivered}/${totalUndelivered} = ${percentage}%`);
    });
    
    // 检查其他物料是否有相同问题
    console.log('\n=== 检查所有多供应商物料 ===');
    const [allMaterials] = await conn.query(`
      SELECT DISTINCT materialCode, COUNT(DISTINCT supplierId) as supplier_count
      FROM material_supplier_mappings
      GROUP BY materialCode
      HAVING supplier_count > 1
      ORDER BY materialCode
      LIMIT 10
    `);
    
    for (const material of allMaterials) {
      const [poDataForMaterial] = await conn.query(`
        SELECT supplierName, SUM(undeliveredQuantity) as total_undelivered
        FROM purchase_orders
        WHERE materialCode = ?
        GROUP BY supplierName
      `, [material.materialCode]);
      
      const [shareDataForMaterial] = await conn.query(`
        SELECT msm.supplierId, s.supplierName, msm.sharePercentage
        FROM material_supplier_mappings msm
        JOIN suppliers s ON msm.supplierId = s.id
        WHERE msm.materialCode = ?
        ORDER BY s.supplierName
      `, [material.materialCode]);
      
      let totalUndeliveredForMaterial = 0;
      poDataForMaterial.forEach(row => {
        totalUndeliveredForMaterial += row.total_undelivered;
      });
      
      let totalShareForMaterial = 0;
      shareDataForMaterial.forEach(row => {
        totalShareForMaterial += parseFloat(row.sharePercentage);
      });
      
      // 检查是否有不匹配
      let hasIssue = false;
      for (const supplier of poDataForMaterial) {
        const calculatedShare = (supplier.total_undelivered / totalUndeliveredForMaterial * 100).toFixed(2);
        const mappedShare = shareDataForMaterial.find(s => s.supplierName === supplier.supplierName);
        if (mappedShare && Math.abs(parseFloat(mappedShare.sharePercentage) - parseFloat(calculatedShare)) > 0.1) {
          hasIssue = true;
          break;
        }
      }
      
      if (hasIssue) {
        console.log(`\n物料 ${material.materialCode}:`);
        console.log(`  采购订单数据: ${JSON.stringify(poDataForMaterial)}`);
        console.log(`  供应商份额: ${JSON.stringify(shareDataForMaterial)}`);
      }
    }
    
  } finally {
    conn.release();
    await pool.end();
  }
}

analyzeShareIssue().catch(console.error);
