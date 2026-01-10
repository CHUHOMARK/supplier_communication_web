import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  materialPlans,
  materialItems,
  suppliers,
  materialSupplierMappings,
  shareChangeHistory,
  generatedEmails,
  InsertMaterialPlan,
  InsertMaterialItem,
  InsertSupplier,
  InsertMaterialSupplierMapping,
  InsertGeneratedEmail,
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
