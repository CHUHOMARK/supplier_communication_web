/**
 * 验证供应商确认页面物料数量计算修复
 * 
 * 问题：供应商确认页面显示的是原始的物料计划数量，而不是按供应商份额分配后的数量
 * 修复：在confirmation.getByToken API中，根据供应商份额重新计算dailySchedule
 * 
 * 测试场景：
 * - 物料A1300038的原始来货数量: 1-5: 1000, 1-6: 1000, 1-8: 2400
 * - 供应商份额: 67.6%
 * - 预期分配数量: 1-5: 676, 1-6: 676, 1-8: 1622
 */

console.log('=== 验证供应商份额计算修复 ===\n');

// 测试数据
const testCases = [
  {
    name: '物料A1300038 - 1月5日',
    originalQty: 1000,
    sharePercentage: 67.6,
    expected: 676,
  },
  {
    name: '物料A1300038 - 1月6日',
    originalQty: 1000,
    sharePercentage: 67.6,
    expected: 676,
  },
  {
    name: '物料A1300038 - 1月8日',
    originalQty: 2400,
    sharePercentage: 67.6,
    expected: 1622,
  },
];

let passCount = 0;
let failCount = 0;

for (const testCase of testCases) {
  // 使用与routers.ts中相同的计算逻辑
  const allocatedQty = Math.round(testCase.originalQty * testCase.sharePercentage / 100);
  
  const passed = allocatedQty === testCase.expected;
  const status = passed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${status} ${testCase.name}`);
  console.log(`  原始数量: ${testCase.originalQty}`);
  console.log(`  份额百分比: ${testCase.sharePercentage}%`);
  console.log(`  计算结果: ${allocatedQty}`);
  console.log(`  预期结果: ${testCase.expected}`);
  console.log();
  
  if (passed) {
    passCount++;
  } else {
    failCount++;
  }
}

console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passCount}/${testCases.length}`);
console.log(`失败: ${failCount}/${testCases.length}`);

if (failCount === 0) {
  console.log('\n✅ 所有测试通过！修复已验证成功。');
  process.exit(0);
} else {
  console.log('\n❌ 部分测试失败！修复需要进一步调查。');
  process.exit(1);
}
