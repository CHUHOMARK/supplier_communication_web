import { eq, and, sql, desc, inArray, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  suppliers,
  materialPlans,
  materialItems,
  materialSupplierMappings,
  generatedEmails,
  shareChangeHistory,
  emailSendLogs,
  supplierConfirmations,
  confirmationModifications,
  purchaseOrders,
  smtpAccounts,
  notifications,
  actualReceipts,
  InsertMaterialPlan,
  InsertMaterialItem,
  InsertSupplier,
  InsertMaterialSupplierMapping,
  InsertGeneratedEmail,
  InsertEmailSendLog,
  InsertConfirmationModification,
  InsertSmtpAccount,
  InsertNotification,
  InsertActualReceipt,
  ActualReceipt,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Material Plans
export async function createMaterialPlan(plan: InsertMaterialPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(materialPlans).values(plan);
  return result[0].insertId;
}

export async function getMaterialPlansByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(materialPlans).where(eq(materialPlans.userId, userId)).orderBy(materialPlans.uploadedAt);
}

export async function getMaterialPlanById(planId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(materialPlans).where(eq(materialPlans.id, planId)).limit(1);
  return result[0];
}

// Material Items
export async function createMaterialItems(items: InsertMaterialItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (items.length === 0) return;
  await db.insert(materialItems).values(items);
}

export async function getMaterialItemsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(materialItems).where(eq(materialItems.planId, planId));
}

// Suppliers
export async function createSupplier(supplier: InsertSupplier) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(suppliers).values(supplier);
  return result[0].insertId;
}

export async function getSuppliersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(suppliers).where(eq(suppliers.userId, userId));
}

export async function updateSupplier(id: number, supplier: Partial<InsertSupplier>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(suppliers).set(supplier).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(suppliers).where(eq(suppliers.id, id));
}

export async function updateSupplierEmail(id: number, email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(suppliers).set({ email }).where(eq(suppliers.id, id));
}

// Material Supplier Mappings
export async function createMaterialSupplierMapping(mapping: InsertMaterialSupplierMapping) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(materialSupplierMappings).values(mapping);
  return result[0].insertId;
}

export async function getMaterialSupplierMappingsByMaterialCode(userId: number, materialCode: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(materialSupplierMappings).where(
    and(
      eq(materialSupplierMappings.userId, userId),
      eq(materialSupplierMappings.materialCode, materialCode)
    )
  );
}

export async function getMaterialSupplierMappingsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(materialSupplierMappings).where(eq(materialSupplierMappings.userId, userId));
}

/**
 * 分页获取物料供应商映射（按物料代码分组）
 * @param userId 用户ID
 * @param page 页码（从0开始）
 * @param pageSize 每页数量
 * @returns { materials: 物料列表, total: 总物料数, page: 当前页, pageSize: 每页数量 }
 */
export async function getMaterialSupplierMappingsPaginated(
  userId: number,
  page: number = 0,
  pageSize: number = 50
) {
  const db = await getDb();
  if (!db) return { materials: [], total: 0, page, pageSize };
  
  // 获取所有映射
  const allMappings = await db
    .select()
    .from(materialSupplierMappings)
    .where(eq(materialSupplierMappings.userId, userId));
  
  // 按物料代码分组
  const materialGroups = new Map<string, typeof allMappings>();
  for (const mapping of allMappings) {
    const key = mapping.materialCode;
    if (!materialGroups.has(key)) {
      materialGroups.set(key, []);
    }
    materialGroups.get(key)!.push(mapping);
  }
  
  // 转换为物料列表
  const materials = Array.from(materialGroups.entries()).map(([code, mappings]) => ({
    materialCode: code,
    supplierCount: mappings.length,
    mappings,
  }));
  
  const total = materials.length;
  const start = page * pageSize;
  const end = start + pageSize;
  const paginatedMaterials = materials.slice(start, end);
  
  return {
    materials: paginatedMaterials,
    total,
    page,
    pageSize,
  };
}

/**
 * 获取物料的所有供应商映射（不分页，用于编辑对话框）
 */
export async function getMaterialSupplierMappingsByMaterialCodeFast(userId: number, materialCode: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(materialSupplierMappings).where(
    and(
      eq(materialSupplierMappings.userId, userId),
      eq(materialSupplierMappings.materialCode, materialCode)
    )
  );
}

export async function updateMaterialSupplierMapping(id: number, mapping: Partial<InsertMaterialSupplierMapping>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(materialSupplierMappings).set(mapping).where(eq(materialSupplierMappings.id, id));
}

export async function deleteMaterialSupplierMapping(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(materialSupplierMappings).where(eq(materialSupplierMappings.id, id));
}

export async function deleteMaterialSupplierMappingsByMaterialCode(userId: number, materialCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(materialSupplierMappings).where(
    and(
      eq(materialSupplierMappings.userId, userId),
      eq(materialSupplierMappings.materialCode, materialCode)
    )
  );
}

// Generated Emails
export async function createGeneratedEmail(email: InsertGeneratedEmail) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(generatedEmails).values(email);
  return result[0].insertId;
}

export async function getGeneratedEmailsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(generatedEmails).where(eq(generatedEmails.planId, planId));
}

export async function deleteGeneratedEmailsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(generatedEmails).where(eq(generatedEmails.planId, planId));
}

// Share Change History
/**
 * 记录份额变更历史
 */
export async function recordShareChange(
  userId: number,
  materialCode: string,
  supplierId: number,
  oldShare: string | null,
  newShare: string,
  reason?: string
) {
  const db = await getDb();
  if (!db) return;

  await db.insert(shareChangeHistory).values({
    userId,
    materialCode,
    supplierId,
    oldSharePercentage: oldShare,
    newSharePercentage: newShare,
    changeReason: reason,
  });
}

/**
 * 获取供应商历史采购统计
 */
export async function getSupplierPurchaseStats(userId: number, supplierId: number) {
  const db = await getDb();
  if (!db) return null;

  // 查询该供应商的所有映射关系
  const mappings = await db
    .select()
    .from(materialSupplierMappings)
    .where(
      and(
        eq(materialSupplierMappings.userId, userId),
        eq(materialSupplierMappings.supplierId, supplierId)
      )
    );

  const materialCount = mappings.length;
  const avgShare = materialCount > 0
    ? mappings.reduce((sum, m) => sum + parseFloat(m.sharePercentage || "0"), 0) / materialCount
    : 0;

  return {
    materialCount,
    avgShare: avgShare.toFixed(2),
    lastUpdated: mappings.length > 0
      ? mappings.reduce((latest, m) => m.updatedAt > latest ? m.updatedAt : latest, mappings[0].updatedAt)
      : null,
  };
}

/**
 * 获取份额变更历史
 */
export async function getShareChangeHistory(userId: number, materialCode?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(shareChangeHistory.userId, userId)];
  if (materialCode) {
    conditions.push(eq(shareChangeHistory.materialCode, materialCode));
  }

  return await db
    .select()
    .from(shareChangeHistory)
    .where(and(...conditions))
    .orderBy(desc(shareChangeHistory.changedAt))
    .limit(100);
}

// ============================================
// 邮件发送记录相关函数
// ============================================

export async function createEmailSendLog(log: InsertEmailSendLog) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(emailSendLogs).values(log);
  return result[0].insertId;
}

export async function updateEmailSendLog(
  logId: number,
  data: { subject?: string; content?: string }
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(emailSendLogs)
    .set(data)
    .where(eq(emailSendLogs.id, logId));
}

export async function updateEmailSendLogStatus(
  logId: number,
  status: "sent" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(emailSendLogs)
    .set({
      status,
      errorMessage: errorMessage || null,
      sentAt: status === "sent" ? new Date() : undefined,
    })
    .where(eq(emailSendLogs.id, logId));
}

export async function getEmailSendLogsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(emailSendLogs)
    .where(eq(emailSendLogs.planId, planId))
    .orderBy(desc(emailSendLogs.createdAt));
}

export async function getEmailSendLogsByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(emailSendLogs)
    .where(eq(emailSendLogs.userId, userId))
    .orderBy(desc(emailSendLogs.createdAt));
}

// ============================================
// 数据重置相关函数
// ============================================

export async function resetUserData(userId: number, options: {
  resetMaterialPlans?: boolean;
  resetSuppliers?: boolean;
  resetMappings?: boolean;
  resetEmails?: boolean;
  resetEmailLogs?: boolean;
  resetConfirmations?: boolean;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const results: Record<string, number> = {};

  // 重置物料计划和物料项
  if (options.resetMaterialPlans) {
    const plans = await db.select().from(materialPlans).where(eq(materialPlans.userId, userId));
    const planIds = plans.map(p => p.id);
    
    if (planIds.length > 0) {
      // 删除物料项
      for (const planId of planIds) {
        await db.delete(materialItems).where(eq(materialItems.planId, planId));
      }
      // 删除物料计划
      const result = await db.delete(materialPlans).where(eq(materialPlans.userId, userId));
      results.materialPlans = planIds.length;
    } else {
      results.materialPlans = 0;
    }
  }

  // 重置供应商
  if (options.resetSuppliers) {
    const result = await db.delete(suppliers).where(eq(suppliers.userId, userId));
    results.suppliers = result[0].affectedRows;
  }

  // 重置供应商映射
  if (options.resetMappings) {
    const result = await db.delete(materialSupplierMappings).where(eq(materialSupplierMappings.userId, userId));
    results.mappings = result[0].affectedRows;
  }

  // 重置生成的邮件
  if (options.resetEmails) {
    const plans = await db.select().from(materialPlans).where(eq(materialPlans.userId, userId));
    const planIds = plans.map(p => p.id);
    
    if (planIds.length > 0) {
      let totalDeleted = 0;
      for (const planId of planIds) {
        const result = await db.delete(generatedEmails).where(eq(generatedEmails.planId, planId));
        totalDeleted += result[0].affectedRows;
      }
      results.emails = totalDeleted;
    } else {
      results.emails = 0;
    }
  }

  // 重置邮件发送记录
  if (options.resetEmailLogs) {
    const result = await db.delete(emailSendLogs).where(eq(emailSendLogs.userId, userId));
    results.emailLogs = result[0].affectedRows;
  }

  // 重置供应商确认监控数据
  if (options.resetConfirmations) {
    const result = await db.delete(supplierConfirmations).where(eq(supplierConfirmations.userId, userId));
    results.confirmations = result[0].affectedRows;
  }

  return results;
}

export async function getUserDataStats(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      materialPlans: 0,
      suppliers: 0,
      mappings: 0,
      emails: 0,
      emailLogs: 0,
    };
  }

  const plans = await db.select().from(materialPlans).where(eq(materialPlans.userId, userId));
  const planIds = plans.map(p => p.id);
  
  let emailsCount = 0;
  if (planIds.length > 0) {
    for (const planId of planIds) {
      const emails = await db.select().from(generatedEmails).where(eq(generatedEmails.planId, planId));
      emailsCount += emails.length;
    }
  }
  
  const [
    suppliersCount,
    mappingsCount,
    emailLogsCount,
  ] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.userId, userId)),
    db.select().from(materialSupplierMappings).where(eq(materialSupplierMappings.userId, userId)),
    db.select().from(emailSendLogs).where(eq(emailSendLogs.userId, userId)),
  ]);

  return {
    materialPlans: plans.length,
    suppliers: suppliersCount.length,
    mappings: mappingsCount.length,
    emails: emailsCount,
    emailLogs: emailLogsCount.length,
  };
}

// ==================== 供应商确认记录相关函数 ====================

/**
 * 创建供应商确认记录
 */
export async function createSupplierConfirmation(data: {
  userId: number;
  planId: number;
  supplierId: number;
  emailLogId?: number;
  confirmToken: string;
  expiresAt: Date;
  status?: 'pending' | 'confirmed' | 'partial' | 'rejected' | 'modified';
  dailySchedule?: Record<string, number>;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 确保 dailySchedule 被正确序列化为 JSON
  const insertData = {
    ...data,
    dailySchedule: data.dailySchedule ? JSON.stringify(data.dailySchedule) : null,
  };

  const result = await db.insert(supplierConfirmations).values(insertData as any);
  return result[0].insertId;
}

/**
 * 根据token获取确认记录
 */
export async function getConfirmationByToken(token: string) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db
    .select()
    .from(supplierConfirmations)
    .where(eq(supplierConfirmations.confirmToken, token))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 更新确认记录状态
 */
export async function updateConfirmationStatus(
  id: number,
  data: {
    status: "pending" | "confirmed" | "partial" | "rejected" | "modified";
    supplierResponse?: string;
    supplierNotes?: string;
    confirmedAt?: Date;
  }
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(supplierConfirmations)
    .set(data)
    .where(eq(supplierConfirmations.id, id));
}

/**
 * 更新确认记录的生产状态
 */
export async function updateConfirmationProductionStatus(
  id: number,
  productionStatus: "not_started" | "material_prep" | "in_production" | "in_qc" | "ready_to_ship" | "shipped"
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(supplierConfirmations)
    .set({ productionStatus })
    .where(eq(supplierConfirmations.id, id));
}

/**
 * 获取物料计划的所有确认记录
 */
export async function getConfirmationsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select({
      confirmation: supplierConfirmations,
      supplier: suppliers,
    })
    .from(supplierConfirmations)
    .leftJoin(suppliers, eq(supplierConfirmations.supplierId, suppliers.id))
    .where(eq(supplierConfirmations.planId, planId))
    .orderBy(supplierConfirmations.createdAt);

  return result;
}

/**
 * 获取供应商确认状态统计（已确认/未确认供应商数量）
 * 逻辑：
 * - 总供应商数 = 用户所有物料计划对应的供应商确认记录中的供应商数（去重）
 * - 已确认供应商数 = 状态为confirmed/partial/modified的供应商数
 * - 未确认供应商数 = 总供应商数 - 已确认供应商数
 */
export async function getSupplierConfirmationStats(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      confirmed: 0,
      unconfirmed: 0,
      total: 0,
    };
  }

  // 获取用户所有物料计划对应的供应商确认记录
  const confirmations = await db
    .select()
    .from(supplierConfirmations)
    .where(eq(supplierConfirmations.userId, userId));

  // 统计所有供应商（去重）
  const allSuppliers = new Set<number>();
  const confirmedSuppliers = new Set<number>();

  confirmations.forEach((record) => {
    // 添加到总供应商集合
    allSuppliers.add(record.supplierId);
    
    // 如果是已确认状态，添加到已确认集合
    const status = record.status || "pending";
    if (status === "confirmed" || status === "partial" || status === "modified") {
      confirmedSuppliers.add(record.supplierId);
    }
  });

  const total = allSuppliers.size;
  const confirmed = confirmedSuppliers.size;
  const unconfirmed = total - confirmed;

  return {
    confirmed,
    unconfirmed,
    total,
  };
}

/**
 * 获取用户的所有确认记录统计
 */
export async function getConfirmationStatsByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      total: 0,
      pending: 0,
      confirmed: 0,
      partial: 0,
      rejected: 0,
      modified: 0,
    };
  }

  const result = await db
    .select()
    .from(supplierConfirmations)
    .where(eq(supplierConfirmations.userId, userId));

  const stats = {
    total: result.length,
    pending: 0,
    confirmed: 0,
    partial: 0,
    rejected: 0,
    modified: 0,
  };

  result.forEach((record) => {
    const status = record.status || "pending"; // 默认为pending
    if (status === "pending") stats.pending++;
    else if (status === "confirmed") stats.confirmed++;
    else if (status === "partial") stats.partial++;
    else if (status === "rejected") stats.rejected++;
    else if (status === "modified") stats.modified++;
  });

  return stats;
}

/**
 * 根据ID获取供应商
 */
export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * 获取指定物料计划中有物料的供应商列表
 */
export async function getSuppliersByPlanId(userId: number, planId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取该计划中的所有物料代码
  const items = await db
    .select({ materialCode: materialItems.materialCode })
    .from(materialItems)
    .where(eq(materialItems.planId, planId));
  
  if (items.length === 0) return [];
  
  const materialCodes = items.map(item => item.materialCode);
  
  // 获取这些物料对应的供应商ID
  const mappings = await db
    .select({ supplierId: materialSupplierMappings.supplierId })
    .from(materialSupplierMappings)
    .where(
      and(
        eq(materialSupplierMappings.userId, userId),
        inArray(materialSupplierMappings.materialCode, materialCodes)
      )
    );
  
  if (mappings.length === 0) return [];
  
  // 去重供应商ID
  const supplierIds = Array.from(new Set(mappings.map(m => m.supplierId)));
  
  // 获取供应商详情
  return await db
    .select()
    .from(suppliers)
    .where(
      and(
        eq(suppliers.userId, userId),
        inArray(suppliers.id, supplierIds)
      )
    );
}

/**
 * 获取指定物料计划中的多供应商物料映射
 */
export async function getMaterialMappingsByPlanId(userId: number, planId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取该计划中的所有物料代码
  const items = await db
    .select({ materialCode: materialItems.materialCode })
    .from(materialItems)
    .where(eq(materialItems.planId, planId));
  
  if (items.length === 0) return [];
  
  const materialCodes = items.map(item => item.materialCode);
  
  // 获取这些物料的映射关系
  const mappings = await db
    .select()
    .from(materialSupplierMappings)
    .where(
      and(
        eq(materialSupplierMappings.userId, userId),
        inArray(materialSupplierMappings.materialCode, materialCodes)
      )
    );
  
  return mappings;
}


/**
 * 保存确认修改历史记录
 */
export async function saveConfirmationModification(data: InsertConfirmationModification) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .insert(confirmationModifications)
    .values(data);
  
  return result;
}

/**
 * 获取确认记录的所有修改历史
 */
export async function getModificationsByConfirmationId(confirmationId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select()
    .from(confirmationModifications)
    .where(eq(confirmationModifications.confirmationId, confirmationId))
    .orderBy(desc(confirmationModifications.modifiedAt));

  return result;
}

/**
 * 获取物料计划的所有修改历史（用于管理员查看）
 */
export async function getModificationsByPlanId(planId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const result = await db
    .select({
      modification: confirmationModifications,
      confirmation: supplierConfirmations,
      supplier: suppliers,
    })
    .from(confirmationModifications)
    .leftJoin(
      supplierConfirmations,
      eq(confirmationModifications.confirmationId, supplierConfirmations.id)
    )
    .leftJoin(
      suppliers,
      eq(supplierConfirmations.supplierId, suppliers.id)
    )
    .where(eq(supplierConfirmations.planId, planId))
    .orderBy(desc(confirmationModifications.modifiedAt));

  return result;
}


/**
 * 根据ID获取确认记录及其关联的供应商信息
 */
export async function getConfirmationById(confirmationId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db
    .select({
      confirmation: supplierConfirmations,
      supplier: suppliers,
    })
    .from(supplierConfirmations)
    .leftJoin(
      suppliers,
      eq(supplierConfirmations.supplierId, suppliers.id)
    )
    .where(eq(supplierConfirmations.id, confirmationId))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 检查是否已存在该计划和供应商的确认记录
 */
export async function getExistingConfirmation(planId: number, supplierId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(supplierConfirmations)
    .where(and(
      eq(supplierConfirmations.planId, planId),
      eq(supplierConfirmations.supplierId, supplierId)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}


/**
 * 重置所有确认记录
 */
export async function resetSupplierConfirmations() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(supplierConfirmations);
}

/**
 * 重置所有邮件发送记录
 */
export async function resetEmailSendLogs() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(emailSendLogs);
}

/**
 * 重置所有生成的邮件
 */
export async function resetGeneratedEmails() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(generatedEmails);
}

/**
 * 获取计划中的所有物料及其供应商分配（分页）
 */
export async function getMaterialsWithSuppliersByPlan(
  planId: number,
  page: number = 0,
  pageSize: number = 50
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 获取该计划的所有物料项
  const allMaterials = await db
    .select()
    .from(materialItems)
    .where(eq(materialItems.planId, planId))
    .orderBy(asc(materialItems.materialCode));

  // 计算分页
  const total = allMaterials.length;
  const start = page * pageSize;
  const end = start + pageSize;
  const paginatedMaterials = allMaterials.slice(start, end);

  // 为每个物料获取供应商分配信息
  const materialsWithSuppliers = await Promise.all(
    paginatedMaterials.map(async (material) => {
      const mappings = await db
        .select({
          supplierId: materialSupplierMappings.supplierId,
          sharePercentage: materialSupplierMappings.sharePercentage,
          supplierName: suppliers.supplierName,
        })
        .from(materialSupplierMappings)
        .leftJoin(
          suppliers,
          eq(materialSupplierMappings.supplierId, suppliers.id)
        )
        .where(
          and(
            eq(materialSupplierMappings.planId, planId),
            eq(materialSupplierMappings.materialCode, material.materialCode)
          )
        )
        .orderBy(desc(materialSupplierMappings.sharePercentage));

      const totalSharePercentage = mappings.reduce(
        (sum, m) => sum + Number(m.sharePercentage || 0),
        0
      );

      // 获取每个供应商的未交付数量
      const undeliveredBySupplier: Record<number, number> = {};
      for (const mapping of mappings) {
        if (mapping.supplierName) {
          const poData = await db
            .select({
              undelivered: sql<number>`COALESCE(SUM(${purchaseOrders.undeliveredQuantity}), 0)`,
            })
            .from(purchaseOrders)
            .where(
              and(
                eq(purchaseOrders.materialCode, material.materialCode),
                eq(purchaseOrders.supplierName, mapping.supplierName)
              )
            );
          undeliveredBySupplier[mapping.supplierId] = Number(poData[0]?.undelivered || 0);
        }
      }

      const totalUndelivered = Object.values(undeliveredBySupplier).reduce((sum, val) => sum + val, 0);

      return {
        materialCode: material.materialCode,
        materialName: material.materialName || "",
        shortage: Number(material.shortage) || 0,
        undeliveredQuantity: totalUndelivered,
        suppliers: mappings.map((m) => ({
          supplierId: m.supplierId,
          supplierName: m.supplierName || "",
          sharePercentage: Number(m.sharePercentage) || 0,
          undeliveredQuantity: undeliveredBySupplier[m.supplierId] || 0,
        })),
        totalSharePercentage,
      };
    })
  );

  return {
    total,
    page,
    pageSize,
    materials: materialsWithSuppliers,
  };
}

/**
 * 获取单个物料的供应商分配详情
 */
export async function getMaterialSupplierAllocationDetail(
  planId: number,
  materialCode: string
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 获取物料项信息
  const material = await db
    .select()
    .from(materialItems)
    .where(
      and(
        eq(materialItems.planId, planId),
        eq(materialItems.materialCode, materialCode)
      )
    )
    .limit(1)
    .then((results) => results[0]);

  if (!material) {
    throw new Error(`Material ${materialCode} not found in plan ${planId}`);
  }

  // 获取供应商分配信息
  const mappings = await db
    .select({
      supplierId: materialSupplierMappings.supplierId,
      sharePercentage: materialSupplierMappings.sharePercentage,
      supplierName: suppliers.supplierName,
    })
    .from(materialSupplierMappings)
    .leftJoin(
      suppliers,
      eq(materialSupplierMappings.supplierId, suppliers.id)
    )
    .where(eq(materialSupplierMappings.materialCode, materialCode))
    .orderBy(desc(materialSupplierMappings.sharePercentage));

  const totalSharePercentage = mappings.reduce(
    (sum, m) => sum + Number(m.sharePercentage || 0),
    0
  );

  return {
    materialCode: material.materialCode,
    materialName: material.materialName || "",
    shortage: Number(material.shortage) || 0,
    suppliers: mappings.map((m) => ({
      supplierId: m.supplierId,
      supplierName: m.supplierName || "",
      sharePercentage: Number(m.sharePercentage) || 0,
    })),
    totalSharePercentage,
  };
}

/**
 * 更新物料的供应商份额分配（删除旧的，插入新的）
 */
export async function updateMaterialSupplierShares(
  materialCode: string,
  shares: Array<{ supplierId: number; sharePercentage: number }>,
  userId: number,
  planId: number
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 验证份额之和
  const totalPercentage = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
  if (shares.length > 0 && Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(
      `Share percentages must sum to 100, got ${totalPercentage}`
    );
  }

  // 使用原生SQL删除该计划中该物料的所有现有映射
  await db.execute(
    sql`DELETE FROM material_supplier_mappings WHERE planId = ${planId} AND materialCode = ${materialCode}`
  );

  // 插入新的映射记录
  if (shares.length > 0) {
    for (const share of shares) {
      await db.execute(
        sql`INSERT INTO material_supplier_mappings (planId, userId, materialCode, supplierId, sharePercentage) 
            VALUES (${planId}, ${userId}, ${materialCode}, ${share.supplierId}, ${share.sharePercentage.toString()})`
      );
    }
  }

  return shares.length;
}

/**
 * SMTP账号管理函数
 */

// 创建SMTP账号
export async function createSmtpAccount(data: InsertSmtpAccount) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 如果设置为默认账号，先将其他账号的isDefault设置为false
  if (data.isDefault) {
    await db.execute(
      sql`UPDATE smtp_accounts SET isDefault = false WHERE userId = ${data.userId}`
    );
  }

  const result = await db.insert(smtpAccounts).values(data);
  return result;
}

// 获取用户的所有SMTP账号
export async function getSmtpAccountsByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const accounts = await db
    .select()
    .from(smtpAccounts)
    .where(eq(smtpAccounts.userId, userId))
    .orderBy(desc(smtpAccounts.isDefault), desc(smtpAccounts.createdAt));

  return accounts;
}

// 获取默认SMTP账号
export async function getDefaultSmtpAccount(userId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const accounts = await db
    .select()
    .from(smtpAccounts)
    .where(
      and(
        eq(smtpAccounts.userId, userId),
        eq(smtpAccounts.isDefault, true),
        eq(smtpAccounts.isActive, true)
      )
    )
    .limit(1);

  return accounts[0] || null;
}

// 根据ID获取SMTP账号
export async function getSmtpAccountById(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const accounts = await db
    .select()
    .from(smtpAccounts)
    .where(and(eq(smtpAccounts.id, id), eq(smtpAccounts.userId, userId)))
    .limit(1);

  return accounts[0] || null;
}

// 更新SMTP账号
export async function updateSmtpAccount(
  id: number,
  userId: number,
  data: Partial<InsertSmtpAccount>
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 如果设置为默认账号，先将其他账号的isDefault设置为false
  if (data.isDefault) {
    await db.execute(
      sql`UPDATE smtp_accounts SET isDefault = false WHERE userId = ${userId} AND id != ${id}`
    );
  }

  await db
    .update(smtpAccounts)
    .set(data)
    .where(and(eq(smtpAccounts.id, id), eq(smtpAccounts.userId, userId)));

  return true;
}

// 删除SMTP账号
export async function deleteSmtpAccount(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .delete(smtpAccounts)
    .where(and(eq(smtpAccounts.id, id), eq(smtpAccounts.userId, userId)));

  return true;
}

// 设置默认SMTP账号
export async function setDefaultSmtpAccount(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 先将所有账号的isDefault设置为false
  await db.execute(
    sql`UPDATE smtp_accounts SET isDefault = false WHERE userId = ${userId}`
  );

  // 将指定账号设置为默认
  await db
    .update(smtpAccounts)
    .set({ isDefault: true })
    .where(and(eq(smtpAccounts.id, id), eq(smtpAccounts.userId, userId)));

  return true;
}

/**
 * 通过用户名查找用户
 */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get user by username:", error);
    return null;
  }
}

/**
 * 通过ID查找用户
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get user by id:", error);
    return null;
  }
}

/**
 * 创建新用户（用于注册）
 */
export async function createUser(data: {
  username: string;
  password: string;
  name?: string;
  email?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  try {
    const result = await db.insert(users).values({
      username: data.username,
      password: data.password,
      name: data.name || data.username,
      email: data.email,
      loginMethod: 'local',
      role: 'user',
      lastSignedIn: new Date(),
    });
    
    // 返回包含id的用户对象
    const insertId = result[0].insertId;
    return {
      id: insertId,
      username: data.username,
      name: data.name || data.username,
      email: data.email || null,
      loginMethod: 'local',
      role: 'user' as const,
    };
  } catch (error) {
    console.error("[Database] Failed to create user:", error);
    throw error;
  }
}

/**
 * 更新用户最后登录时间
 */
export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Failed to update last signed in:", error);
  }
}


// ==================== 图表数据统计函数 ====================

/**
 * 获取邮件发送量趋势数据（最近30天）
 */
export async function getEmailSendTrend(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await db
    .select()
    .from(emailSendLogs)
    .where(eq(emailSendLogs.userId, userId));

  // 按日期聚合
  const trendMap = new Map<string, number>();
  logs.forEach((log) => {
    if (log.sentAt && log.sentAt >= startDate) {
      const dateKey = log.sentAt.toISOString().split('T')[0];
      trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
    }
  });

  // 填充缺失的日期
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    result.push({
      date: dateKey,
      count: trendMap.get(dateKey) || 0,
    });
  }

  return result;
}

/**
 * 获取确认率趋势数据（最近30天）
 */
export async function getConfirmationRateTrend(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const confirmations = await db
    .select()
    .from(supplierConfirmations)
    .where(eq(supplierConfirmations.userId, userId));

  // 按日期聚合
  const trendMap = new Map<string, { total: number; confirmed: number }>();
  confirmations.forEach((conf) => {
    if (conf.createdAt && conf.createdAt >= startDate) {
      const dateKey = conf.createdAt.toISOString().split('T')[0];
      const current = trendMap.get(dateKey) || { total: 0, confirmed: 0 };
      current.total++;
      if (conf.status === 'confirmed' || conf.status === 'modified') {
        current.confirmed++;
      }
      trendMap.set(dateKey, current);
    }
  });

  // 填充缺失的日期并计算确认率
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    const data = trendMap.get(dateKey) || { total: 0, confirmed: 0 };
    result.push({
      date: dateKey,
      total: data.total,
      confirmed: data.confirmed,
      rate: data.total > 0 ? Math.round((data.confirmed / data.total) * 100) : 0,
    });
  }

  return result;
}

/**
 * 获取供应商响应时间统计（平均响应时间，单位：小时）
 */
export async function getSupplierResponseTimeStats(userId: number) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const confirmations = await db
    .select()
    .from(supplierConfirmations)
    .where(eq(supplierConfirmations.userId, userId));

  const responseTimeMap = new Map<number, { totalTime: number; count: number; name: string }>();

  for (const conf of confirmations) {
    if (conf.confirmedAt && conf.createdAt) {
      const responseTime = (conf.confirmedAt.getTime() - conf.createdAt.getTime()) / (1000 * 60 * 60); // 转换为小时
      
      // 获取供应商名称
      const supplier = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, conf.supplierId))
        .limit(1);

      if (supplier.length > 0) {
        const current = responseTimeMap.get(conf.supplierId) || {
          totalTime: 0,
          count: 0,
          name: supplier[0].supplierName,
        };
        current.totalTime += responseTime;
        current.count++;
        responseTimeMap.set(conf.supplierId, current);
      }
    }
  }

  // 计算平均响应时间
  const result = Array.from(responseTimeMap.entries())
    .map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.name,
      avgResponseTime: Math.round(data.totalTime / data.count * 10) / 10, // 保留1位小数
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count) // 按响应次数排序
    .slice(0, 10); // 只取前10个

  return result;
}


// ==================== 通知相关函数 ====================

/**
 * 创建通知
 */
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) {
    return null;
  }

  const result = await db.insert(notifications).values(data);
  return result;
}

/**
 * 获取用户的通知列表
 */
export async function getNotificationsByUserId(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  return await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * 获取用户的未读通知数量
 */
export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  const result = await db
    .select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));

  return result.length;
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    return false;
  }

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));

  return true;
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) {
    return false;
  }

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ));

  return true;
}

/**
 * 删除通知
 */
export async function deleteNotification(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    return false;
  }

  await db
    .delete(notifications)
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId)
    ));

  return true;
}


// ==================== ERP实际到货相关函数 ====================

/**
 * 批量创建实际到货记录
 * 为避免SQL语句过长，分批插入
 * 如果遇到重复记录，则更新actualQuantity和supplierName
 */
export async function createActualReceipts(receipts: InsertActualReceipt[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  
  // 分批插入，每批100条
  const batchSize = 100;
  const results = [];
  
  for (let i = 0; i < receipts.length; i += batchSize) {
    const batch = receipts.slice(i, i + batchSize);
    const result = await db.insert(actualReceipts)
      .values(batch)
      .onDuplicateKeyUpdate({
        set: {
          actualQuantity: sql`VALUES(actualQuantity)`,
          supplierName: sql`VALUES(supplierName)`,
          updatedAt: sql`NOW()`,
        },
      });
    results.push(result);
  }
  
  return results[results.length - 1]; // 返回最后一批的结果
}

/**
 * 获取用户的所有实际到货记录
 */
export async function getActualReceiptsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  return await db
    .select()
    .from(actualReceipts)
    .where(eq(actualReceipts.userId, userId))
    .orderBy(desc(actualReceipts.businessDate));
}

/**
 * 根据物料代码和日期范围获取实际到货记录
 */
export async function getActualReceiptsByMaterialAndDateRange(
  userId: number,
  materialCode: string,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  return await db
    .select()
    .from(actualReceipts)
    .where(
      and(
        eq(actualReceipts.userId, userId),
        eq(actualReceipts.materialCode, materialCode),
        sql`${actualReceipts.businessDate} >= ${startDate}`,
        sql`${actualReceipts.businessDate} <= ${endDate}`
      )
    )
    .orderBy(asc(actualReceipts.businessDate));
}

/**
 * 删除实际到货记录
 */
export async function deleteActualReceipt(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  return await db
    .delete(actualReceipts)
    .where(and(eq(actualReceipts.id, id), eq(actualReceipts.userId, userId)));
}

/**
 * 获取供应商逾期统计
 * 对比supplier_confirmations中的确认日期与actual_receipts中的业务日期
 * 计算每个供应商的平均逾期天数
 */
export async function getSupplierOverdueAnalysis(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  
  // 查询所有确认记录和对应的实际到货记录
  const confirmations = await db
    .select({
      confirmationId: supplierConfirmations.id,
      supplierId: supplierConfirmations.supplierId,
      supplierName: suppliers.supplierName,
      planId: supplierConfirmations.planId,
      confirmedSchedule: supplierConfirmations.dailySchedule,
      confirmedAt: supplierConfirmations.confirmedAt,
    })
    .from(supplierConfirmations)
    .leftJoin(suppliers, eq(supplierConfirmations.supplierId, suppliers.id))
    .where(
      and(
        eq(supplierConfirmations.userId, userId),
        inArray(supplierConfirmations.status, ["confirmed", "partial", "modified"])
      )
    );
  
  // 获取所有实际到货记录
  const receipts = await getActualReceiptsByUserId(userId);
  
  // 构建物料代码 -> 到货记录的映射
  const receiptMap = new Map<string, Map<string, number>>();
  receipts.forEach((receipt: any) => {
    if (!receiptMap.has(receipt.materialCode)) {
      receiptMap.set(receipt.materialCode, new Map());
    }
    receiptMap.get(receipt.materialCode)!.set(receipt.businessDate, parseFloat(receipt.actualQuantity));
  });
  
  // 计算每个供应商的逾期情况
  const supplierOverdueMap = new Map<number, {
    supplierId: number;
    supplierName: string;
    totalOverdueDays: number;
    overdueCount: number;
    onTimeCount: number;
  }>();
  
  confirmations.forEach((confirmation: any) => {
    if (!confirmation.confirmedSchedule || !confirmation.supplierId) return;
    
    try {
      const schedule = typeof confirmation.confirmedSchedule === 'string'
        ? JSON.parse(confirmation.confirmedSchedule)
        : confirmation.confirmedSchedule;
      // 暂时跳过，因为没有materialCode字段
      // const materialReceipts = receiptMap.get(confirmation.materialCode);
      
      // if (!materialReceipts) return;
      
      // 遍历确认的每个日期
      Object.entries(schedule).forEach(([confirmedDate, quantity]: [string, any]) => {
        if (typeof quantity !== 'number' || quantity <= 0) return;
        
        // 查找实际到货日期
        let actualDate: string | null = null;
        // for (const [receiptDate, receiptQty] of materialReceipts.entries()) {
        //   if (receiptQty > 0) {
        //     actualDate = receiptDate;
        //     break;
        //   }
        // }
        
        if (!actualDate) return;
        
        // 计算逾期天数
        const confirmedTime = new Date(confirmedDate).getTime();
        const actualTime = new Date(actualDate).getTime();
        const overdueDays = Math.floor((actualTime - confirmedTime) / (1000 * 60 * 60 * 24));
        
        // 更新供应商统计
        if (!supplierOverdueMap.has(confirmation.supplierId!)) {
          supplierOverdueMap.set(confirmation.supplierId!, {
            supplierId: confirmation.supplierId!,
            supplierName: confirmation.supplierName || "未知供应商",
            totalOverdueDays: 0,
            overdueCount: 0,
            onTimeCount: 0,
          });
        }
        
        const stats = supplierOverdueMap.get(confirmation.supplierId!)!;
        if (overdueDays > 0) {
          stats.totalOverdueDays += overdueDays;
          stats.overdueCount++;
        } else {
          stats.onTimeCount++;
        }
      });
    } catch (error) {
      console.error(`解析确认记录${confirmation.confirmationId}的schedule失败:`, error);
    }
  });
  
  // 计算平均逾期天数
  return Array.from(supplierOverdueMap.values()).map(stats => ({
    ...stats,
    averageOverdueDays: stats.overdueCount > 0 
      ? Math.round(stats.totalOverdueDays / stats.overdueCount * 10) / 10 
      : 0,
  }));
}

/**
 * 获取确认记录的实际到货信息
 * 用于在确认监控页面显示ERP实收到货数据
 */
export async function getActualReceiptsForConfirmations(userId: number, confirmationIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");
  
  // 查询确认记录，关联materialSupplierMappings获取物料代码
  const confirmations = await db
    .select({
      id: supplierConfirmations.id,
      planId: supplierConfirmations.planId,
      supplierId: supplierConfirmations.supplierId,
      confirmedSchedule: supplierConfirmations.dailySchedule,
      materialCode: materialSupplierMappings.materialCode,
    })
    .from(supplierConfirmations)
    .leftJoin(
      materialSupplierMappings,
      and(
        eq(supplierConfirmations.supplierId, materialSupplierMappings.supplierId),
        eq(supplierConfirmations.planId, materialSupplierMappings.planId)
      )
    )
    .where(
      and(
        eq(supplierConfirmations.userId, userId),
        inArray(supplierConfirmations.id, confirmationIds)
      )
    );
  
  // 获取所有相关的物料代码
  const materialCodes = Array.from(new Set(confirmations.map((c: any) => c.materialCode).filter((code: any) => code)));
  
  if (materialCodes.length === 0) {
    return confirmations.map((c: any) => ({
      confirmationId: c.id,
      materialCode: null,
      actualReceiptDate: null,
      actualQuantity: 0,
      overdueDays: 0,
      isOverdue: false,
    }));
  }
  
  // 查询这些物料的实际到货记录
  const receipts = await db
    .select()
    .from(actualReceipts)
    .where(
      and(
        eq(actualReceipts.userId, userId),
        inArray(actualReceipts.materialCode, materialCodes as string[])
      )
    );
  
  // 构建返回结果
  return confirmations.map((confirmation: any) => {
    const materialReceipts = receipts.filter((r: any) => r.materialCode === confirmation.materialCode);
    
    // 解析确认的交期
    let confirmedDates: string[] = [];
    try {
      if (confirmation.confirmedSchedule) {
        const schedule = typeof confirmation.confirmedSchedule === 'string' 
          ? JSON.parse(confirmation.confirmedSchedule)
          : confirmation.confirmedSchedule;
        confirmedDates = Object.keys(schedule);
      }
    } catch (error) {
      console.error(`解析确认记录${confirmation.id}的schedule失败:`, error);
    }
    
    // 查找最早的实际到货日期
    let earliestReceiptDate: string | null = null;
    let totalActualQuantity = 0;
    
    materialReceipts.forEach((receipt: any) => {
      totalActualQuantity += parseFloat(receipt.actualQuantity);
      if (!earliestReceiptDate || receipt.businessDate < earliestReceiptDate) {
        earliestReceiptDate = receipt.businessDate;
      }
    });
    
    // 计算逾期天数（如果有实际到货且有确认日期）
    let overdueDays = 0;
    if (earliestReceiptDate && confirmedDates.length > 0) {
      const earliestConfirmedDate = confirmedDates.sort()[0];
      const confirmedTime = new Date(earliestConfirmedDate).getTime();
      const actualTime = new Date(earliestReceiptDate).getTime();
      overdueDays = Math.floor((actualTime - confirmedTime) / (1000 * 60 * 60 * 24));
    }
    
    return {
      confirmationId: confirmation.id,
      materialCode: confirmation.materialCode,
      actualReceiptDate: earliestReceiptDate,
      actualQuantity: totalActualQuantity,
      overdueDays,
      isOverdue: overdueDays > 0,
    };
  });
}


// ==================== 计划与实际对比分析相关函数 ====================




// ==================== 供应商绩效报表相关函数 ====================

/**
 * 获取供应商准时率统计
 * @param userId 用户ID
 * @param planId 物料计划ID
 * @returns 供应商准时率统计列表
 */
export async function getSupplierPerformanceStats(userId: number, planId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  // 1. 获取该计划的所有供应商确认记录
  const confirmations = await db
    .select({
      confirmationId: supplierConfirmations.id,
      supplierId: supplierConfirmations.supplierId,
      supplierName: suppliers.supplierName,
      dailySchedule: supplierConfirmations.dailySchedule,
    })
    .from(supplierConfirmations)
    .innerJoin(suppliers, eq(suppliers.id, supplierConfirmations.supplierId))
    .where(
      and(
        eq(supplierConfirmations.userId, userId),
        eq(supplierConfirmations.planId, planId)
      )
    );

  // 2. 获取该计划的日期范围
  const plan = await db
    .select()
    .from(materialPlans)
    .where(and(eq(materialPlans.id, planId), eq(materialPlans.userId, userId)))
    .limit(1);

  if (plan.length === 0) {
    throw new Error("Material plan not found");
  }

  const { planStartDate, planEndDate } = plan[0];

  // 3. 获取该用户在日期范围内的所有ERP实际到货记录
  const actualReceiptsList = await db
    .select()
    .from(actualReceipts)
    .where(
      and(
        eq(actualReceipts.userId, userId),
        sql`${actualReceipts.businessDate} >= ${planStartDate}`,
        sql`${actualReceipts.businessDate} <= ${planEndDate}`
      )
    );

  // 4. 获取物料-供应商映射关系
  const mappings = await db
    .select()
    .from(materialSupplierMappings)
    .where(eq(materialSupplierMappings.planId, planId));

  // 5. 计算每个供应商的准时率
  const performanceStats = await Promise.all(
    confirmations.map(async (confirmation) => {
      const dailySchedule = confirmation.dailySchedule as Record<string, number> || {};
      
      // 获取该供应商负责的物料
      const supplierMaterials = mappings
        .filter((m) => m.supplierId === confirmation.supplierId)
        .map((m) => m.materialCode);

      // 获取该供应商的实际到货记录
      const supplierReceipts = actualReceiptsList.filter(
        (receipt: ActualReceipt) => 
          supplierMaterials.includes(receipt.materialCode) &&
          receipt.supplierName === confirmation.supplierName
      );

      // 按日期对比承诺和实际
      let onTimeCount = 0;
      let lateCount = 0;
      let totalDelayDays = 0;

      Object.keys(dailySchedule).forEach((promisedDate) => {
        const promisedQuantity = dailySchedule[promisedDate];
        
        // 查找该日期的实际到货
        const actualReceipt = supplierReceipts.find(
          (r: ActualReceipt) => r.businessDate === promisedDate
        );

        if (actualReceipt) {
          // 准时到货
          onTimeCount++;
        } else {
          // 查找是否有延迟到货
          const laterReceipts = supplierReceipts.filter(
            (r: ActualReceipt) => r.businessDate > promisedDate
          );

          if (laterReceipts.length > 0) {
            // 找到最早的延迟到货记录
            const earliestLateReceipt = laterReceipts.sort(
              (a: ActualReceipt, b: ActualReceipt) => 
                a.businessDate.localeCompare(b.businessDate)
            )[0];

            // 计算延迟天数
            const promisedDateObj = new Date(promisedDate);
            const actualDateObj = new Date(earliestLateReceipt.businessDate);
            const delayDays = Math.floor(
              (actualDateObj.getTime() - promisedDateObj.getTime()) / (1000 * 60 * 60 * 24)
            );

            lateCount++;
            totalDelayDays += delayDays;
          } else {
            // 完全没有到货，视为严重逾期
            lateCount++;
            totalDelayDays += 999; // 使用一个大数值表示严重逾期
          }
        }
      });

      const totalCount = onTimeCount + lateCount;
      const onTimeRate = totalCount > 0 ? (onTimeCount / totalCount) * 100 : 0;
      const lateRate = totalCount > 0 ? (lateCount / totalCount) * 100 : 0;
      const avgDelayDays = lateCount > 0 ? totalDelayDays / lateCount : 0;

      return {
        supplierId: confirmation.supplierId,
        supplierName: confirmation.supplierName,
        onTimeCount,
        lateCount,
        totalCount,
        onTimeRate,
        lateRate,
        avgDelayDays,
      };
    })
  );

  return performanceStats;
}

/**
 * 获取逾期排行榜
 * @param userId 用户ID
 * @param planId 物料计划ID
 * @returns 逾期排行榜（按逾期次数降序）
 */
export async function getOverdueRanking(userId: number, planId: number) {
  const performanceStats = await getSupplierPerformanceStats(userId, planId);
  
  // 按逾期次数降序排序
  const ranking = performanceStats
    .sort((a, b) => b.lateCount - a.lateCount)
    .map((stat, index) => ({
      rank: index + 1,
      ...stat,
    }));

  return ranking;
}

/**
 * 获取准时率趋势
 * @param userId 用户ID
 * @param planId 物料计划ID
 * @returns 按日期的准时率趋势数据
 */
export async function getOnTimeRateTrend(userId: number, planId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  // 1. 获取该计划的所有供应商确认记录
  const confirmations = await db
    .select({
      confirmationId: supplierConfirmations.id,
      supplierId: supplierConfirmations.supplierId,
      supplierName: suppliers.supplierName,
      dailySchedule: supplierConfirmations.dailySchedule,
    })
    .from(supplierConfirmations)
    .innerJoin(suppliers, eq(suppliers.id, supplierConfirmations.supplierId))
    .where(
      and(
        eq(supplierConfirmations.userId, userId),
        eq(supplierConfirmations.planId, planId)
      )
    );

  // 2. 获取该计划的日期范围
  const plan = await db
    .select()
    .from(materialPlans)
    .where(and(eq(materialPlans.id, planId), eq(materialPlans.userId, userId)))
    .limit(1);

  if (plan.length === 0) {
    throw new Error("Material plan not found");
  }

  const { planStartDate, planEndDate } = plan[0];

  // 3. 获取该用户在日期范围内的所有ERP实际到货记录
  const actualReceiptsList = await db
    .select()
    .from(actualReceipts)
    .where(
      and(
        eq(actualReceipts.userId, userId),
        sql`${actualReceipts.businessDate} >= ${planStartDate}`,
        sql`${actualReceipts.businessDate} <= ${planEndDate}`
      )
    );

  // 4. 获取物料-供应商映射关系
  const mappings = await db
    .select()
    .from(materialSupplierMappings)
    .where(eq(materialSupplierMappings.planId, planId));

  // 5. 收集所有承诺日期
  const allDates = new Set<string>();
  confirmations.forEach((confirmation) => {
    const dailySchedule = confirmation.dailySchedule as Record<string, number> || {};
    Object.keys(dailySchedule).forEach((date) => allDates.add(date));
  });

  // 6. 按日期计算准时率
  const trendData = Array.from(allDates)
    .sort()
    .map((date) => {
      let onTimeCount = 0;
      let totalCount = 0;

      confirmations.forEach((confirmation) => {
        const dailySchedule = confirmation.dailySchedule as Record<string, number> || {};
        
        if (dailySchedule[date]) {
          totalCount++;

          // 获取该供应商负责的物料
          const supplierMaterials = mappings
            .filter((m) => m.supplierId === confirmation.supplierId)
            .map((m) => m.materialCode);

          // 查找该日期的实际到货
          const actualReceipt = actualReceiptsList.find(
            (r: ActualReceipt) => 
              r.businessDate === date &&
              supplierMaterials.includes(r.materialCode) &&
              r.supplierName === confirmation.supplierName
          );

          if (actualReceipt) {
            onTimeCount++;
          }
        }
      });

      const onTimeRate = totalCount > 0 ? (onTimeCount / totalCount) * 100 : 0;

      return {
        date,
        onTimeCount,
        totalCount,
        onTimeRate,
      };
    });

  return trendData;
}

/**
 * 获取供应商承诺vs实际对比数据
 * @param userId 用户ID
 * @param planId 物料计划ID
 * @param supplierId 供应商ID
 * @returns 该供应商的承诺交期和实际到货对比数据
 */
export async function getSupplierDeliveryComparison(
  userId: number,
  planId: number,
  supplierId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  // 1. 获取该供应商的确认记录
  const confirmation = await db
    .select({
      confirmationId: supplierConfirmations.id,
      supplierId: supplierConfirmations.supplierId,
      supplierName: suppliers.supplierName,
      dailySchedule: supplierConfirmations.dailySchedule,
    })
    .from(supplierConfirmations)
    .innerJoin(suppliers, eq(suppliers.id, supplierConfirmations.supplierId))
    .where(
      and(
        eq(supplierConfirmations.userId, userId),
        eq(supplierConfirmations.planId, planId),
        eq(supplierConfirmations.supplierId, supplierId)
      )
    )
    .limit(1);

  if (confirmation.length === 0) {
    throw new Error("Supplier confirmation not found");
  }

  const { supplierName, dailySchedule } = confirmation[0];

  // 2. 获取该计划的日期范围
  const plan = await db
    .select()
    .from(materialPlans)
    .where(and(eq(materialPlans.id, planId), eq(materialPlans.userId, userId)))
    .limit(1);

  if (plan.length === 0) {
    throw new Error("Material plan not found");
  }

  const { planStartDate, planEndDate } = plan[0];

  // 3. 获取该供应商负责的物料
  const mappings = await db
    .select()
    .from(materialSupplierMappings)
    .where(
      and(
        eq(materialSupplierMappings.planId, planId),
        eq(materialSupplierMappings.supplierId, supplierId)
      )
    );

  const supplierMaterials = mappings.map((m) => m.materialCode);

  // 4. 获取该供应商的实际到货记录
  const actualReceiptsList = await db
    .select()
    .from(actualReceipts)
    .where(
      and(
        eq(actualReceipts.userId, userId),
        eq(actualReceipts.supplierName, supplierName),
        sql`${actualReceipts.businessDate} >= ${planStartDate}`,
        sql`${actualReceipts.businessDate} <= ${planEndDate}`
      )
    );

  // 5. 按日期对比承诺和实际
  const schedule = dailySchedule as Record<string, number> || {};
  const comparisonData = Object.keys(schedule).map((date) => {
    const promisedQuantity = schedule[date];
    
    // 查找该日期的实际到货
    const actualReceipt = actualReceiptsList.find(
      (r: ActualReceipt) => 
        r.businessDate === date &&
        supplierMaterials.includes(r.materialCode)
    );

    const actualQuantity = actualReceipt ? parseFloat(actualReceipt.actualQuantity) : 0;
    const difference = actualQuantity - promisedQuantity;
    const status = actualReceipt ? "on_time" : "late";

    // 如果逾期，计算延迟天数
    let delayDays = 0;
    if (!actualReceipt) {
      const laterReceipts = actualReceiptsList.filter(
        (r: ActualReceipt) => 
          r.businessDate > date &&
          supplierMaterials.includes(r.materialCode)
      );

      if (laterReceipts.length > 0) {
        const earliestLateReceipt = laterReceipts.sort(
          (a: ActualReceipt, b: ActualReceipt) => 
            a.businessDate.localeCompare(b.businessDate)
        )[0];

        const promisedDateObj = new Date(date);
        const actualDateObj = new Date(earliestLateReceipt.businessDate);
        delayDays = Math.floor(
          (actualDateObj.getTime() - promisedDateObj.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    return {
      date,
      promisedQuantity,
      actualQuantity,
      difference,
      status,
      delayDays,
    };
  });

  return {
    supplierId,
    supplierName,
    comparisonData,
  };
}
