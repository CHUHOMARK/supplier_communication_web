#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/mysql2';
import { supplierConfirmations, suppliers, materialItems } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const db = drizzle(process.env.DATABASE_URL);

async function verifyDailySchedule() {
  console.log('🔍 验证 supplier_confirmations 表中的 dailySchedule 数据\n');
  
  try {
    // 查询所有供应商确认记录
    const confirmations = await db.select().from(supplierConfirmations).limit(10);
    
    if (confirmations.length === 0) {
      console.log('❌ 没有找到供应商确认记录');
      return;
    }
    
    console.log(`✅ 找到 ${confirmations.length} 条供应商确认记录\n`);
    
    for (const confirmation of confirmations) {
      console.log(`📋 确认记录 ID: ${confirmation.id}`);
      console.log(`   供应商ID: ${confirmation.supplierId}`);
      console.log(`   计划ID: ${confirmation.planId}`);
      console.log(`   确认Token: ${confirmation.confirmToken.substring(0, 10)}...`);
      console.log(`   状态: ${confirmation.status}`);
      
      if (confirmation.dailySchedule) {
        console.log(`   ✅ dailySchedule 已保存:`);
        
        // 如果是字符串，则进行JSON解析
        let schedule = confirmation.dailySchedule;
        if (typeof schedule === 'string') {
          try {
            schedule = JSON.parse(schedule);
          } catch (e) {
            console.log(`   ❌ dailySchedule 解析失败: ${e.message}`);
            console.log('');
            continue;
          }
        }
        
        const dates = Object.keys(schedule).sort();
        
        for (const date of dates) {
          const qty = schedule[date];
          console.log(`      ${date}: ${qty} 单位`);
        }
        
        // 计算总数量
        const totalQty = Object.values(schedule).reduce((sum, qty) => sum + (typeof qty === 'number' ? qty : 0), 0);
        console.log(`      📊 总计: ${totalQty} 单位`);
      } else {
        console.log(`   ❌ dailySchedule 未保存 (为 null)`);
      }
      
      console.log('');
    }
    
    // 统计信息
    console.log('📊 统计信息:');
    const withSchedule = confirmations.filter(c => c.dailySchedule && Object.keys(c.dailySchedule).length > 0).length;
    const withoutSchedule = confirmations.length - withSchedule;
    
    console.log(`   ✅ 有 dailySchedule 的记录: ${withSchedule}`);
    console.log(`   ❌ 没有 dailySchedule 的记录: ${withoutSchedule}`);
    console.log(`   总计: ${confirmations.length}`);
    
    if (withSchedule === confirmations.length) {
      console.log('\n✅ 所有供应商确认记录都正确保存了 dailySchedule 数据！');
    } else if (withSchedule > 0) {
      console.log('\n⚠️  部分供应商确认记录缺少 dailySchedule 数据');
    } else {
      console.log('\n❌ 没有供应商确认记录包含 dailySchedule 数据');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

verifyDailySchedule();
