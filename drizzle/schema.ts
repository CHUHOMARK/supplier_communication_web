import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal, unique, index, check } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 物料计划表
 */
export const materialPlans = mysqlTable("material_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  planStartDate: varchar("planStartDate", { length: 20 }).notNull(),
  planEndDate: varchar("planEndDate", { length: 20 }).notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type MaterialPlan = typeof materialPlans.$inferSelect;
export type InsertMaterialPlan = typeof materialPlans.$inferInsert;

/**
 * 物料明细表
 */
export const materialItems = mysqlTable("material_items", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  materialCode: varchar("materialCode", { length: 100 }).notNull(),
  materialName: varchar("materialName", { length: 255 }).notNull(),
  materialSpec: text("materialSpec"),
  unitUsage: text("unitUsage"),
  demand: text("demand"),
  inventory: text("inventory"),
  shortage: text("shortage"),
  inTransit: text("inTransit"),
  total: text("total"),
  dailySchedule: json("dailySchedule").$type<Record<string, number>>(),
});

export type MaterialItem = typeof materialItems.$inferSelect;
export type InsertMaterialItem = typeof materialItems.$inferInsert;

/**
 * 供应商表
 */
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  supplierName: varchar("supplierName", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 100 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

/**
 * 物料-供应商映射表（支持多供应商份额分配）
 */
export const materialSupplierMappings = mysqlTable("material_supplier_mappings", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  userId: int("userId").notNull(),
  materialCode: varchar("materialCode", { length: 100 }).notNull(),
  supplierId: int("supplierId").notNull(),
  /**
   * 供应商份额（百分比，0-100）
   * 同一物料的所有供应商份额总和应为100
   */
  sharePercentage: decimal("sharePercentage", { precision: 5, scale: 2 }).default("100.00").notNull(),
  /**
   * 优先级（数字越小优先级越高）
   */
  priority: int("priority").default(1).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  planIdIdx: index("idx_plan_id").on(table.planId),
  userIdIdx: index("idx_user_id").on(table.userId),
  materialCodeIdx: index("idx_material_code").on(table.materialCode),
  userMaterialIdx: index("idx_user_material").on(table.userId, table.materialCode),
  planMaterialIdx: index("idx_plan_material").on(table.planId, table.materialCode),
}));

export type MaterialSupplierMapping = typeof materialSupplierMappings.$inferSelect;
export type InsertMaterialSupplierMapping = typeof materialSupplierMappings.$inferInsert;

/**
 * 份额变更历史记录表
 */
export const shareChangeHistory = mysqlTable("share_change_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  materialCode: varchar("materialCode", { length: 100 }).notNull(),
  supplierId: int("supplierId").notNull(),
  oldSharePercentage: decimal("oldSharePercentage", { precision: 5, scale: 2 }),
  newSharePercentage: decimal("newSharePercentage", { precision: 5, scale: 2 }).notNull(),
  changeReason: text("changeReason"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});

export type ShareChangeHistory = typeof shareChangeHistory.$inferSelect;
export type InsertShareChangeHistory = typeof shareChangeHistory.$inferInsert;

/**
 * 邮件发送记录表
 */
export const emailSendLogs = mysqlTable("email_send_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  supplierId: int("supplierId").notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailSendLog = typeof emailSendLogs.$inferSelect;
export type InsertEmailSendLog = typeof emailSendLogs.$inferInsert;

/**
 * 供应商确认记录表
 */
export const supplierConfirmations = mysqlTable("supplier_confirmations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // 采购方用户ID
  planId: int("planId").notNull(), // 物料计划ID
  supplierId: int("supplierId").notNull(), // 供应商ID
  emailLogId: int("emailLogId"), // 关联的邮件发送记录ID
  confirmToken: varchar("confirmToken", { length: 64 }).notNull().unique(), // 确认token
  status: mysqlEnum("status", ["pending", "confirmed", "partial", "rejected", "modified"]).default("pending").notNull(),
  supplierResponse: text("supplierResponse"), // 供应商的响应内容（JSON）
  supplierNotes: text("supplierNotes"), // 供应商备注
  confirmedAt: timestamp("confirmedAt"), // 确认时间
  expiresAt: timestamp("expiresAt").notNull(), // 链接过期时间
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  uniquePlanSupplier: unique("unique_plan_supplier").on(table.planId, table.supplierId),
  checkStatusNotNull: check("check_status_not_null", sql`status IS NOT NULL`),
}));

export type SupplierConfirmation = typeof supplierConfirmations.$inferSelect;
export type InsertSupplierConfirmation = typeof supplierConfirmations.$inferInsert;

/**
 * 生成的邮件记录表
 */
export const generatedEmails = mysqlTable("generated_emails", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  supplierId: int("supplierId").notNull(),
  emailSubject: varchar("emailSubject", { length: 500 }).notNull(),
  emailBody: text("emailBody").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type GeneratedEmail = typeof generatedEmails.$inferSelect;
export type InsertGeneratedEmail = typeof generatedEmails.$inferInsert;

/**
 * 采购订单表
 */
export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  businessDate: timestamp("businessDate").notNull(), // 业务日期
  poNumber: varchar("poNumber", { length: 100 }).notNull(), // 单据编号
  supplierName: varchar("supplierName", { length: 255 }).notNull(), // 供应商名称
  materialCode: varchar("materialCode", { length: 100 }).notNull(), // 料号
  materialName: varchar("materialName", { length: 255 }).notNull(), // 料品名称
  materialSpec: text("materialSpec"), // 料品规格
  purchaseQuantity: int("purchaseQuantity").notNull(), // 采购数量
  confirmedQuantity: int("confirmedQuantity").notNull(), // 确认数量
  receivedQuantity: int("receivedQuantity").notNull(), // 累计实收数量
  undeliveredQuantity: int("undeliveredQuantity").notNull(), // 未到货数量
  requiredDeliveryDate: varchar("requiredDeliveryDate", { length: 50 }), // 要求交货日期
  purchaseStaff: varchar("purchaseStaff", { length: 100 }), // 采购业务员名称
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_po_user_id").on(table.userId),
  materialCodeIdx: index("idx_po_material_code").on(table.materialCode),
  supplierNameIdx: index("idx_po_supplier_name").on(table.supplierName),
  materialSupplierIdx: index("idx_po_material_supplier").on(table.materialCode, table.supplierName),
}));

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

/**
 * 确认修改历史记录表（供应商修改交期数量的历史记录）
 */
export const confirmationModifications = mysqlTable("confirmation_modifications", {
  id: int("id").autoincrement().primaryKey(),
  confirmationId: int("confirmationId").notNull(), // 关联的确认记录ID
  materialCode: varchar("materialCode", { length: 100 }).notNull(), // 物料代码
  originalSchedule: json("originalSchedule").$type<Record<string, number>>().notNull(), // 原始交期数量
  modifiedSchedule: json("modifiedSchedule").$type<Record<string, number>>().notNull(), // 修改后的交期数量
  modificationReason: text("modificationReason"), // 修改原因
  modifiedAt: timestamp("modifiedAt").defaultNow().notNull(), // 修改时间
});

export type ConfirmationModification = typeof confirmationModifications.$inferSelect;
export type InsertConfirmationModification = typeof confirmationModifications.$inferInsert;
