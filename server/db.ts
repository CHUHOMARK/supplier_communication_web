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
  InsertMaterialPlan,
  InsertMaterialItem,
  InsertSupplier,
  InsertMaterialSupplierMapping,
  InsertGeneratedEmail,
  InsertEmailSendLog,
  InsertConfirmationModification,
  InsertSmtpAccount,
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
