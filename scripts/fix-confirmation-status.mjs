#!/usr/bin/env node

/**
 * 数据修复脚本：修复所有status为null的确认记录
 * 用法: node scripts/fix-confirmation-status.mjs
 */

import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置');
  process.exit(1);
}

// 解析 DATABASE_URL
// 格式: mysql://user:password@host:port/database
const urlMatch = DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (!urlMatch) {
  console.error('❌ DATABASE_URL 格式不正确');
  process.exit(1);
}

const [, user, password, host, port, database] = urlMatch;

async function fixConfirmationStatus() {
  let connection;
  try {
    console.log('🔧 正在连接数据库...');
    connection = await createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database,
      ssl: {},
    });

    console.log('✅ 数据库连接成功');

    // 查询status为null的记录数
    console.log('\n📊 查询status为null的确认记录...');
    const [nullRecords] = await connection.execute(
      'SELECT COUNT(*) as count FROM supplier_confirmations WHERE status IS NULL'
    );
    const nullCount = nullRecords[0].count;
    console.log(`📈 找到 ${nullCount} 条status为null的记录`);

    if (nullCount === 0) {
      console.log('✅ 没有需要修复的记录');
      await connection.end();
      return;
    }

    // 执行修复
    console.log('\n🔄 正在修复数据...');
    const [result] = await connection.execute(
      'UPDATE supplier_confirmations SET status = ? WHERE status IS NULL',
      ['pending']
    );
    console.log(`✅ 成功修复 ${result.affectedRows} 条记录`);

    // 验证修复结果
    console.log('\n✓ 验证修复结果...');
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'modified' THEN 1 ELSE 0 END) as modified,
        SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_count
      FROM supplier_confirmations
    `);

    const stat = stats[0];
    console.log('\n📊 修复后的统计数据：');
    console.log(`  总数: ${stat.total}`);
    console.log(`  待确认: ${stat.pending}`);
    console.log(`  已确认: ${stat.confirmed}`);
    console.log(`  部分确认: ${stat.partial}`);
    console.log(`  拒绝: ${stat.rejected}`);
    console.log(`  已修改: ${stat.modified}`);
    console.log(`  NULL值: ${stat.null_count}`);

    if (stat.null_count === 0) {
      console.log('\n✅ 所有status为null的记录已成功修复！');
    } else {
      console.log(`\n⚠️  仍有 ${stat.null_count} 条记录的status为NULL`);
    }

    await connection.end();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

// 执行修复
fixConfirmationStatus();
