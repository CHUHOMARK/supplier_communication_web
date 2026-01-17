import { eq, and, sql, desc, inArray } from "drizzle-orm";
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
  InsertMaterialPlan,
  InsertMaterialItem,
  InsertSupplier,
  InsertMaterialSupplierMapping,
  InsertGeneratedEmail,
  InsertEmailSendLog,
  InsertConfirmationModification,
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
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(supplierConfirmations).values(data);
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
    if (record.status === "pending") stats.pending++;
    else if (record.status === "confirmed") stats.confirmed++;
    else if (record.status === "partial") stats.partial++;
    else if (record.status === "rejected") stats.rejected++;
    else if (record.status === "modified") stats.modified++;
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
