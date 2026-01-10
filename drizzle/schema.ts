import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

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
 * 物料计划表 - 存储上传的物料计划数据
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
 * 物料明细表 - 存储物料计划中的具体物料信息
 */
export const materialItems = mysqlTable("material_items", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  materialCode: varchar("materialCode", { length: 100 }).notNull(),
  materialName: text("materialName").notNull(),
  materialSpec: text("materialSpec"),
  unitUsage: decimal("unitUsage", { precision: 10, scale: 2 }),
  demand: decimal("demand", { precision: 15, scale: 2 }),
  inventory: decimal("inventory", { precision: 15, scale: 2 }),
  shortage: decimal("shortage", { precision: 15, scale: 2 }),
  inTransit: decimal("inTransit", { precision: 15, scale: 2 }),
  total: decimal("total", { precision: 15, scale: 2 }),
  // 存储每日到货计划的JSON数据 {date: amount}
  dailySchedule: json("dailySchedule").$type<Record<string, number>>(),
});

export type MaterialItem = typeof materialItems.$inferSelect;
export type InsertMaterialItem = typeof materialItems.$inferInsert;

/**
 * 供应商信息表
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
 * 物料-供应商映射表
 */
export const materialSupplierMappings = mysqlTable("material_supplier_mappings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  materialCode: varchar("materialCode", { length: 100 }).notNull(),
  supplierId: int("supplierId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaterialSupplierMapping = typeof materialSupplierMappings.$inferSelect;
export type InsertMaterialSupplierMapping = typeof materialSupplierMappings.$inferInsert;

/**
 * 生成的邮件记录表
 */
export const generatedEmails = mysqlTable("generated_emails", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  supplierId: int("supplierId").notNull(),
  emailSubject: text("emailSubject").notNull(),
  emailBody: text("emailBody").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type GeneratedEmail = typeof generatedEmails.$inferSelect;
export type InsertGeneratedEmail = typeof generatedEmails.$inferInsert;
