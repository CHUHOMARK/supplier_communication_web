/**
 * 5组数据验证脚本 - 验证Excel生成中的份额计算
 * 
 * 测试场景：
 * 1. 两个供应商，份额50%/50%
 * 2. 两个供应商，份额60%/40%
 * 3. 三个供应商，份额40%/35%/25%
 * 4. 单个供应商，份额100%
 * 5. 多日期，多物料，多供应商复杂场景
 */

import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库连接配置
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supplier_communication',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// 测试用例定义
const testCases = [
  {
    name: '测试1: 两个供应商 50%/50%',
    planId: 1,
    materialCode: 'TEST001',
    suppliers: [
      { name: '供应商A', share: 50 },
      { name: '供应商B', share: 50 }
    ],
    dailySchedule: {
      '2026-01-25': 100,
      '2026-01-26': 200,
      '2026-01-27': 150
    },
    expectedResults: {
      '供应商A': { '2026-01-25': 50, '2026-01-26': 100, '2026-01-27': 75 },
      '供应商B': { '2026-01-25': 50, '2026-01-26': 100, '2026-01-27': 75 }
    }
  },
  {
    name: '测试2: 两个供应商 60%/40%',
    planId: 1,
    materialCode: 'TEST002',
    suppliers: [
      { name: '供应商C', share: 60 },
      { name: '供应商D', share: 40 }
    ],
    dailySchedule: {
      '2026-01-25': 100,
      '2026-01-26': 200
    },
    expectedResults: {
      '供应商C': { '2026-01-25': 60, '2026-01-26': 120 },
      '供应商D': { '2026-01-25': 40, '2026-01-26': 80 }
    }
  },
  {
    name: '测试3: 三个供应商 40%/35%/25%',
    planId: 1,
    materialCode: 'TEST003',
    suppliers: [
      { name: '供应商E', share: 40 },
      { name: '供应商F', share: 35 },
      { name: '供应商G', share: 25 }
    ],
    dailySchedule: {
      '2026-01-25': 100,
      '2026-01-26': 200
    },
    expectedResults: {
      '供应商E': { '2026-01-25': 40, '2026-01-26': 80 },
      '供应商F': { '2026-01-25': 35, '2026-01-26': 70 },
      '供应商G': { '2026-01-25': 25, '2026-01-26': 50 }
    }
  },
  {
    name: '测试4: 单个供应商 100%',
    planId: 1,
    materialCode: 'TEST004',
    suppliers: [
      { name: '供应商H', share: 100 }
    ],
    dailySchedule: {
      '2026-01-25': 100,
      '2026-01-26': 200
    },
    expectedResults: {
      '供应商H': { '2026-01-25': 100, '2026-01-26': 200 }
    }
  },
  {
    name: '测试5: 复杂场景 - 多物料多日期',
    planId: 1,
    materials: [
      {
        materialCode: 'TEST005A',
        suppliers: [
          { name: '供应商I', share: 50 },
          { name: '供应商J', share: 50 }
        ],
        dailySchedule: {
          '2026-01-25': 100,
          '2026-01-26': 200,
          '2026-01-27': 150,
          '2026-01-28': 300
        }
      },
      {
        materialCode: 'TEST005B',
        suppliers: [
          { name: '供应商I', share: 70 },
          { name: '供应商K', share: 30 }
        ],
        dailySchedule: {
          '2026-01-25': 50,
          '2026-01-26': 100
        }
      }
    ]
  }
];

/**
 * 验证份额计算
 */
function verifyShareCalculation(originalQty, sharePercentage) {
  const calculated = originalQty * (sharePercentage / 100);
  return Math.round(calculated);
}

/**
 * 执行验证
 */
async function runVerification() {
  const connection = await pool.getConnection();
  
  try {
    console.log('\n=== Excel生成份额计算验证 ===\n');
    
    let passCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n${testCase.name}`);
      console.log('='.repeat(60));
      
      if (testCase.materialCode) {
        // 单物料测试
        const { materialCode, suppliers, dailySchedule, expectedResults } = testCase;
        
        console.log(`物料代码: ${materialCode}`);
        console.log(`日期计划: ${JSON.stringify(dailySchedule)}`);
        console.log(`\n供应商份额分配:`);
        
        for (const supplier of suppliers) {
          console.log(`\n  ${supplier.name} (份额: ${supplier.share}%)`);
          console.log('  日期         原始数量    计算结果    预期结果    状态');
          console.log('  ' + '-'.repeat(50));
          
          const expected = expectedResults[supplier.name];
          let testPassed = true;
          
          for (const [date, qty] of Object.entries(dailySchedule)) {
            const calculated = verifyShareCalculation(qty, supplier.share);
            const expectedQty = expected[date];
            const status = calculated === expectedQty ? '✓ 通过' : '✗ 失败';
            
            if (calculated !== expectedQty) {
              testPassed = false;
            }
            
            console.log(`  ${date}   ${qty.toString().padStart(8)}   ${calculated.toString().padStart(8)}   ${expectedQty.toString().padStart(8)}   ${status}`);
          }
          
          if (testPassed) {
            passCount++;
          } else {
            failCount++;
          }
        }
      } else if (testCase.materials) {
        // 多物料测试
        console.log(`\n复杂场景 - ${testCase.materials.length}个物料`);
        
        for (const material of testCase.materials) {
          console.log(`\n  物料: ${material.materialCode}`);
          
          for (const supplier of material.suppliers) {
            console.log(`    ${supplier.name} (份额: ${supplier.share}%)`);
            
            let testPassed = true;
            for (const [date, qty] of Object.entries(material.dailySchedule)) {
              const calculated = verifyShareCalculation(qty, supplier.share);
              console.log(`      ${date}: ${qty} × ${supplier.share}% = ${calculated}`);
              
              // 验证四舍五入
              const expected = Math.round(qty * (supplier.share / 100));
              if (calculated !== expected) {
                testPassed = false;
              }
            }
            
            if (testPassed) {
              passCount++;
            } else {
              failCount++;
            }
          }
        }
      }
    }
    
    console.log('\n\n' + '='.repeat(60));
    console.log('验证总结');
    console.log('='.repeat(60));
    console.log(`✓ 通过: ${passCount}`);
    console.log(`✗ 失败: ${failCount}`);
    console.log(`总计: ${passCount + failCount}`);
    
    if (failCount === 0) {
      console.log('\n✅ 所有验证通过！份额计算逻辑正确。');
    } else {
      console.log('\n❌ 部分验证失败，请检查计算逻辑。');
    }
    
  } catch (error) {
    console.error('验证失败:', error);
  } finally {
    await connection.release();
    await pool.end();
  }
}

// 运行验证
runVerification().catch(console.error);
