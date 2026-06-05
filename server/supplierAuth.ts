import { getDb } from "./db";
import { supplierAccounts, suppliers, supplierMessages, supplierProductionProgress, materialSupplierMappings, materialItems, materialPlans, supplierConfirmations } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

async function getDatabase() {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  return database;
}

// ============ 供应商账号管理 ============

/**
 * 创建供应商账号
 */
export async function createSupplierAccount(data: {
  supplierId: number;
  userId: number;
  supplierCode: string;
  pinCode: string;
}) {
  const hashedPin = await bcrypt.hash(data.pinCode, 10);
  const result = await (await getDatabase()).insert(supplierAccounts).values({
    supplierId: data.supplierId,
    userId: data.userId,
    supplierCode: data.supplierCode,
    pinCode: hashedPin,
  });
  return result[0].insertId;
}

/**
 * 根据供应商编号获取账号
 */
export async function getSupplierAccountByCode(supplierCode: string) {
  const results = await (await getDatabase())
    .select()
    .from(supplierAccounts)
    .where(eq(supplierAccounts.supplierCode, supplierCode))
    .limit(1);
  return results[0] || null;
}

/**
 * 根据供应商ID获取账号
 */
export async function getSupplierAccountBySupplierId(supplierId: number) {
  const results = await (await getDatabase())
    .select()
    .from(supplierAccounts)
    .where(eq(supplierAccounts.supplierId, supplierId))
    .limit(1);
  return results[0] || null;
}

/**
 * 根据管理员用户ID获取所有供应商账号
 */
export async function getSupplierAccountsByUserId(userId: number) {
  const results = await (await getDatabase())
    .select({
      account: supplierAccounts,
      supplier: suppliers,
    })
    .from(supplierAccounts)
    .innerJoin(suppliers, eq(supplierAccounts.supplierId, suppliers.id))
    .where(eq(supplierAccounts.userId, userId))
    .orderBy(desc(supplierAccounts.createdAt));
  return results;
}

/**
 * 验证供应商PIN码
 */
export async function verifySupplierPin(supplierCode: string, pinCode: string) {
  const account = await getSupplierAccountByCode(supplierCode);
  if (!account || !account.isActive) return null;
  
  const isValid = await bcrypt.compare(pinCode, account.pinCode);
  if (!isValid) return null;
  
  return account;
}

/**
 * 更新供应商最后登录时间
 */
export async function updateSupplierLastLogin(accountId: number) {
  await (await getDatabase())
    .update(supplierAccounts)
    .set({ lastLoginAt: new Date() })
    .where(eq(supplierAccounts.id, accountId));
}

/**
 * 更新供应商PIN码
 */
export async function updateSupplierPin(accountId: number, newPin: string) {
  const hashedPin = await bcrypt.hash(newPin, 10);
  await (await getDatabase())
    .update(supplierAccounts)
    .set({ pinCode: hashedPin, isFirstLogin: false })
    .where(eq(supplierAccounts.id, accountId));
}

/**
 * 更新供应商编号
 */
export async function updateSupplierCode(accountId: number, newCode: string) {
  await (await getDatabase())
    .update(supplierAccounts)
    .set({ supplierCode: newCode })
    .where(eq(supplierAccounts.id, accountId));
}

/**
 * 标记首次登录完成
 */
export async function markFirstLoginComplete(accountId: number) {
  await (await getDatabase())
    .update(supplierAccounts)
    .set({ isFirstLogin: false })
    .where(eq(supplierAccounts.id, accountId));
}

/**
 * 生成供应商编号 (S1-XXX)
 */
export async function generateSupplierCode(userId: number): Promise<string> {
  const existingAccounts = await (await getDatabase())
    .select({ supplierCode: supplierAccounts.supplierCode })
    .from(supplierAccounts)
    .where(eq(supplierAccounts.userId, userId));
  
  // 找出最大编号
  let maxNum = 0;
  for (const acc of existingAccounts) {
    const match = acc.supplierCode.match(/S1-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  
  const nextNum = maxNum + 1;
  return `S1-${String(nextNum).padStart(3, '0')}`;
}

/**
 * 删除供应商账号
 */
export async function deleteSupplierAccount(accountId: number, userId: number) {
  await (await getDatabase())
    .delete(supplierAccounts)
    .where(and(eq(supplierAccounts.id, accountId), eq(supplierAccounts.userId, userId)));
}

/**
 * 重置供应商PIN码
 */
export async function resetSupplierPin(accountId: number, newPin: string) {
  const hashedPin = await bcrypt.hash(newPin, 10);
  await (await getDatabase())
    .update(supplierAccounts)
    .set({ pinCode: hashedPin, isFirstLogin: true })
    .where(eq(supplierAccounts.id, accountId));
}

// ============ 供应商门户数据查询 ============

/**
 * 获取供应商分配的物料列表
 */
export async function getSupplierMaterials(supplierId: number, userId: number) {
  // 获取最新的物料计划
  const plans = await (await getDatabase())
    .select()
    .from(materialPlans)
    .where(eq(materialPlans.userId, userId))
    .orderBy(desc(materialPlans.uploadedAt))
    .limit(1);
  
  if (plans.length === 0) return { plan: null, materials: [] };
  
  const plan = plans[0];
  
  // 获取该供应商的物料映射
  const mappings = await (await getDatabase())
    .select()
    .from(materialSupplierMappings)
    .where(
      and(
        eq(materialSupplierMappings.supplierId, supplierId),
        eq(materialSupplierMappings.planId, plan.id)
      )
    );
  
  if (mappings.length === 0) return { plan, materials: [] };
  
  // 获取物料明细
  const materialCodes = mappings.map((m: any) => m.materialCode);
  const items = await (await getDatabase())
    .select()
    .from(materialItems)
    .where(eq(materialItems.planId, plan.id));
  
  const filteredItems = items.filter((item: any) => materialCodes.includes(item.materialCode));
  
  // 合并份额信息
  const result = filteredItems.map((item: any) => {
    const mapping = mappings.find((m: any) => m.materialCode === item.materialCode);
    return {
      ...item,
      sharePercentage: mapping?.sharePercentage || "100",
      allocatedShortage: item.shortage ? Math.round(parseFloat(item.shortage) * parseFloat(mapping?.sharePercentage || "100") / 100) : 0,
    };
  });
  
  return { plan, materials: result };
}

/**
 * 获取供应商交货计划（每日交货量网格）
 */
export async function getSupplierDeliverySchedule(supplierId: number, userId: number) {
  // 获取最新的物料计划
  const plans = await (await getDatabase())
    .select()
    .from(materialPlans)
    .where(eq(materialPlans.userId, userId))
    .orderBy(desc(materialPlans.uploadedAt))
    .limit(1);
  
  if (plans.length === 0) return { plan: null, schedule: [] };
  
  const plan = plans[0];
  
  // 获取该供应商的物料映射
  const mappings = await (await getDatabase())
    .select()
    .from(materialSupplierMappings)
    .where(
      and(
        eq(materialSupplierMappings.supplierId, supplierId),
        eq(materialSupplierMappings.planId, plan.id)
      )
    );
  
  if (mappings.length === 0) return { plan, schedule: [] };
  
  // 获取物料明细
  const items = await (await getDatabase())
    .select()
    .from(materialItems)
    .where(eq(materialItems.planId, plan.id));
  
  const materialCodes = mappings.map((m: any) => m.materialCode);
  const filteredItems = items.filter((item: any) => materialCodes.includes(item.materialCode));
  
  // 按日期汇总交货量
  const schedule = filteredItems.map((item: any) => {
    const mapping = mappings.find((m: any) => m.materialCode === item.materialCode);
    const sharePercentage = parseFloat(mapping?.sharePercentage || "100") / 100;
    const dailySchedule = (item.dailySchedule || {}) as Record<string, number>;
    
    // 按份额计算每日分配量
    const allocatedSchedule: Record<string, number> = {};
    for (const [date, qty] of Object.entries(dailySchedule)) {
      allocatedSchedule[date] = Math.round((qty as number) * sharePercentage);
    }
    
    return {
      materialCode: item.materialCode,
      materialName: item.materialName,
      sharePercentage: mapping?.sharePercentage || "100",
      dailySchedule: allocatedSchedule,
    };
  });
  
  return { plan, schedule };
}

/**
 * 获取供应商生产进度
 */
export async function getSupplierProgress(supplierId: number, planId: number) {
  const results = await (await getDatabase())
    .select()
    .from(supplierProductionProgress)
    .where(
      and(
        eq(supplierProductionProgress.supplierId, supplierId),
        eq(supplierProductionProgress.planId, planId)
      )
    );
  return results;
}

/**
 * 更新供应商生产进度
 */
export async function updateSupplierProgress(data: {
  supplierId: number;
  planId: number;
  materialCode: string;
  currentStep: "material_prep" | "scheduling" | "quality_check" | "shipping" | "delivered";
  notes?: string;
}) {
  const stepTimeField = {
    material_prep: "materialPrepAt",
    scheduling: "schedulingAt",
    quality_check: "qualityCheckAt",
    shipping: "shippingAt",
    delivered: "deliveredAt",
  }[data.currentStep];
  
  // 使用upsert
  const existing = await (await getDatabase())
    .select()
    .from(supplierProductionProgress)
    .where(
      and(
        eq(supplierProductionProgress.supplierId, data.supplierId),
        eq(supplierProductionProgress.planId, data.planId),
        eq(supplierProductionProgress.materialCode, data.materialCode)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    await (await getDatabase())
      .update(supplierProductionProgress)
      .set({
        currentStep: data.currentStep,
        [stepTimeField]: new Date(),
        notes: data.notes,
      })
      .where(eq(supplierProductionProgress.id, existing[0].id));
  } else {
    await (await getDatabase()).insert(supplierProductionProgress).values({
      supplierId: data.supplierId,
      planId: data.planId,
      materialCode: data.materialCode,
      currentStep: data.currentStep,
      [stepTimeField]: new Date(),
      notes: data.notes,
    });
  }
}

/**
 * 批量更新供应商生产进度
 */
export async function batchUpdateSupplierProgress(data: {
  supplierId: number;
  planId: number;
  materialCodes: string[];
  currentStep: "material_prep" | "scheduling" | "quality_check" | "shipping" | "delivered";
  notes?: string;
}) {
  for (const materialCode of data.materialCodes) {
    await updateSupplierProgress({
      supplierId: data.supplierId,
      planId: data.planId,
      materialCode,
      currentStep: data.currentStep,
      notes: data.notes,
    });
  }
}

// ============ 供应商确认相关 ============

/**
 * 获取供应商的确认记录
 */
export async function getSupplierConfirmations(supplierId: number) {
  const results = await (await getDatabase())
    .select()
    .from(supplierConfirmations)
    .where(eq(supplierConfirmations.supplierId, supplierId))
    .orderBy(desc(supplierConfirmations.createdAt));
  return results;
}

// ============ 供应商消息 ============

/**
 * 获取供应商消息列表
 */
export async function getSupplierMessages(supplierId: number, limit = 50) {
  const results = await (await getDatabase())
    .select()
    .from(supplierMessages)
    .where(eq(supplierMessages.supplierId, supplierId))
    .orderBy(desc(supplierMessages.createdAt))
    .limit(limit);
  return results;
}

/**
 * 获取供应商未读消息数量
 */
export async function getSupplierUnreadMessageCount(supplierId: number) {
  const results = await (await getDatabase())
    .select({ count: sql<number>`count(*)` })
    .from(supplierMessages)
    .where(
      and(
        eq(supplierMessages.supplierId, supplierId),
        eq(supplierMessages.isRead, false)
      )
    );
  return results[0]?.count || 0;
}

/**
 * 标记供应商消息为已读
 */
export async function markSupplierMessageAsRead(messageId: number, supplierId: number) {
  await (await getDatabase())
    .update(supplierMessages)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(supplierMessages.id, messageId),
        eq(supplierMessages.supplierId, supplierId)
      )
    );
}

/**
 * 标记所有供应商消息为已读
 */
export async function markAllSupplierMessagesAsRead(supplierId: number) {
  await (await getDatabase())
    .update(supplierMessages)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(supplierMessages.supplierId, supplierId),
        eq(supplierMessages.isRead, false)
      )
    );
}

/**
 * 创建供应商消息
 */
export async function createSupplierMessage(data: {
  supplierId: number;
  userId: number;
  type: "new_plan" | "plan_update" | "reminder" | "system";
  title: string;
  content: string;
  relatedPlanId?: number;
}) {
  await (await getDatabase()).insert(supplierMessages).values(data);
}
