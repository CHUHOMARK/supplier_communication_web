/**
 * 5组数据验证脚本 - 验证Excel生成中的份额计算逻辑
 * 
 * 测试场景：
 * 1. 两个供应商，份额50%/50%
 * 2. 两个供应商，份额60%/40%
 * 3. 三个供应商，份额40%/35%/25%
 * 4. 单个供应商，份额100%
 * 5. 多日期，多物料，多供应商复杂场景
 */

// 模拟Excel生成中的份额计算逻辑（来自excelGenerator.ts第143-147行）
function calculateAllocatedQuantity(qty, sharePercentage) {
  const allocatedQty = sharePercentage 
    ? qty * (parseFloat(sharePercentage) / 100)
    : qty;
  return allocatedQty > 0 ? Math.round(allocatedQty) : 0;
}

// 模拟邮件生成中的份额计算逻辑（来自emailGenerator.ts第103-106行）
function calculateEmailQuantity(qty, sharePercentage) {
  const allocatedQty = sharePercentage 
    ? qty * (parseFloat(sharePercentage) / 100)
    : qty;
  return allocatedQty > 0 ? allocatedQty.toFixed(0) : '';
}

// 测试用例定义
const testCases = [
  {
    name: '测试1: 两个供应商 50%/50%',
    materialCode: 'TEST001',
    suppliers: [
      { name: '供应商A', share: '50' },
      { name: '供应商B', share: '50' }
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
    materialCode: 'TEST002',
    suppliers: [
      { name: '供应商C', share: '60' },
      { name: '供应商D', share: '40' }
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
    materialCode: 'TEST003',
    suppliers: [
      { name: '供应商E', share: '40' },
      { name: '供应商F', share: '35' },
      { name: '供应商G', share: '25' }
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
    materialCode: 'TEST004',
    suppliers: [
      { name: '供应商H', share: '100' }
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
    name: '测试5: 复杂场景 - 多物料多日期多供应商',
    materials: [
      {
        materialCode: 'TEST005A',
        suppliers: [
          { name: '供应商I', share: '50' },
          { name: '供应商J', share: '50' }
        ],
        dailySchedule: {
          '2026-01-25': 100,
          '2026-01-26': 200,
          '2026-01-27': 150,
          '2026-01-28': 300
        },
        expectedResults: {
          '供应商I': { '2026-01-25': 50, '2026-01-26': 100, '2026-01-27': 75, '2026-01-28': 150 },
          '供应商J': { '2026-01-25': 50, '2026-01-26': 100, '2026-01-27': 75, '2026-01-28': 150 }
        }
      },
      {
        materialCode: 'TEST005B',
        suppliers: [
          { name: '供应商I', share: '70' },
          { name: '供应商K', share: '30' }
        ],
        dailySchedule: {
          '2026-01-25': 50,
          '2026-01-26': 100
        },
        expectedResults: {
          '供应商I': { '2026-01-25': 35, '2026-01-26': 70 },
          '供应商K': { '2026-01-25': 15, '2026-01-26': 30 }
        }
      }
    ]
  }
];

/**
 * 执行验证
 */
function runVerification() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        Excel生成份额计算逻辑验证 (5组测试)              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (let caseIndex = 0; caseIndex < testCases.length; caseIndex++) {
    const testCase = testCases[caseIndex];
    console.log(`\n${testCase.name}`);
    console.log('═'.repeat(60));
    
    if (testCase.materialCode) {
      // 单物料测试
      const { materialCode, suppliers, dailySchedule, expectedResults } = testCase;
      
      console.log(`物料代码: ${materialCode}`);
      console.log(`日期计划: ${JSON.stringify(dailySchedule)}\n`);
      
      for (const supplier of suppliers) {
        console.log(`  📦 ${supplier.name} (份额: ${supplier.share}%)`);
        console.log('  ┌─────────────┬──────────┬──────────┬──────────┬────────┐');
        console.log('  │    日期     │ 原始数量 │ Excel结果 │ 邮件结果 │  状态  │');
        console.log('  ├─────────────┼──────────┼──────────┼──────────┼────────┤');
        
        const expected = expectedResults[supplier.name];
        let supplierPassed = true;
        
        for (const [date, qty] of Object.entries(dailySchedule)) {
          const excelResult = calculateAllocatedQuantity(qty, supplier.share);
          const emailResult = calculateEmailQuantity(qty, supplier.share);
          const expectedQty = expected[date];
          
          const excelMatch = excelResult === expectedQty;
          const emailMatch = parseInt(emailResult) === expectedQty;
          const passed = excelMatch && emailMatch;
          
          if (!passed) {
            supplierPassed = false;
          }
          
          const status = passed ? '✓ 通过' : '✗ 失败';
          const statusColor = passed ? '\x1b[32m' : '\x1b[31m';
          
          console.log(
            `  │ ${date} │ ${qty.toString().padStart(8)} │ ${excelResult.toString().padStart(8)} │ ${emailResult.padStart(8)} │ ${statusColor}${status}\x1b[0m │`
          );
          
          totalTests++;
          if (passed) {
            passedTests++;
          } else {
            failedTests++;
          }
        }
        
        console.log('  └─────────────┴──────────┴──────────┴──────────┴────────┘');
      }
    } else if (testCase.materials) {
      // 多物料测试
      console.log(`复杂场景 - ${testCase.materials.length}个物料\n`);
      
      for (const material of testCase.materials) {
        console.log(`  📦 ${material.materialCode}`);
        
        for (const supplier of material.suppliers) {
          console.log(`     ${supplier.name} (份额: ${supplier.share}%)`);
          console.log('     ┌─────────────┬──────────┬──────────┬────────┐');
          console.log('     │    日期     │ 原始数量 │ 计算结果 │  状态  │');
          console.log('     ├─────────────┼──────────┼──────────┼────────┤');
          
          const expected = material.expectedResults[supplier.name];
          
          for (const [date, qty] of Object.entries(material.dailySchedule)) {
            const calculated = calculateAllocatedQuantity(qty, supplier.share);
            const expectedQty = expected[date];
            const passed = calculated === expectedQty;
            
            const status = passed ? '✓ 通过' : '✗ 失败';
            const statusColor = passed ? '\x1b[32m' : '\x1b[31m';
            
            console.log(
              `     │ ${date} │ ${qty.toString().padStart(8)} │ ${calculated.toString().padStart(8)} │ ${statusColor}${status}\x1b[0m │`
            );
            
            totalTests++;
            if (passed) {
              passedTests++;
            } else {
              failedTests++;
            }
          }
          
          console.log('     └─────────────┴──────────┴──────────┴────────┘');
        }
      }
    }
  }
  
  // 输出总结
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    验证总结                              ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║ 总测试数:  ${totalTests.toString().padEnd(48)} ║`);
  console.log(`║ \x1b[32m✓ 通过:     ${passedTests.toString().padEnd(48)}\x1b[0m ║`);
  console.log(`║ \x1b[31m✗ 失败:     ${failedTests.toString().padEnd(48)}\x1b[0m ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  
  if (failedTests === 0) {
    console.log('║ \x1b[32m✅ 所有验证通过！份额计算逻辑完全正确。\x1b[0m              ║');
  } else {
    console.log('║ \x1b[31m❌ 部分验证失败，请检查计算逻辑。\x1b[0m                  ║');
  }
  
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  // 输出详细验证说明
  console.log('📋 验证说明:');
  console.log('  • Excel结果: 使用Math.round()四舍五入');
  console.log('  • 邮件结果: 使用toFixed(0)保留整数');
  console.log('  • 两个结果应该一致');
  console.log('  • 所有供应商份额之和应该等于100%\n');
  
  return failedTests === 0;
}

// 运行验证
const success = runVerification();
process.exit(success ? 0 : 1);
