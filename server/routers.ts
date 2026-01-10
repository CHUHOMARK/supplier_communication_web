import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { parseMaterialPlanExcel, parseSupplierMappingExcel } from "./excelParser";
import { generateSupplierEmail, generateEmailCSV } from "./emailGenerator";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 物料计划管理
  materialPlan: router({
    // 上传并解析物料计划Excel
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileBase64: z.string(),
        planStartDate: z.string(),
        planEndDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 解析Base64
          const buffer = Buffer.from(input.fileBase64, 'base64');
          
          // 解析Excel
          const items = parseMaterialPlanExcel(buffer);
          
          // 创建物料计划记录
          const planId = await db.createMaterialPlan({
            userId: ctx.user.id,
            fileName: input.fileName,
            planStartDate: input.planStartDate,
            planEndDate: input.planEndDate,
          });
          
          // 批量插入物料明细
          const materialItems = items.map(item => ({
            planId: Number(planId),
            materialCode: item.materialCode,
            materialName: item.materialName,
            materialSpec: item.materialSpec || null,
            unitUsage: item.unitUsage?.toString() || null,
            demand: item.demand?.toString() || null,
            inventory: item.inventory?.toString() || null,
            shortage: item.shortage?.toString() || null,
            inTransit: item.inTransit?.toString() || null,
            total: item.total?.toString() || null,
            dailySchedule: item.dailySchedule || null,
          }));
          
          await db.createMaterialItems(materialItems);
          
          return {
            success: true,
            planId: Number(planId),
            itemCount: items.length,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '文件解析失败',
          });
        }
      }),
    
    // 获取用户的所有物料计划
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMaterialPlansByUserId(ctx.user.id);
    }),
    
    // 获取物料计划详情
    getById: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ input }) => {
        const plan = await db.getMaterialPlanById(input.planId);
        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '物料计划不存在',
          });
        }
        
        const items = await db.getMaterialItemsByPlanId(input.planId);
        
        return {
          plan,
          items,
        };
      }),
  }),

  // 供应商管理
  supplier: router({
    // 获取所有供应商
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSuppliersByUserId(ctx.user.id);
    }),
    
    // 创建供应商
    create: protectedProcedure
      .input(z.object({
        supplierName: z.string(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supplierId = await db.createSupplier({
          userId: ctx.user.id,
          ...input,
        });
        return { supplierId: Number(supplierId) };
      }),
    
    // 更新供应商
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        supplierName: z.string().optional(),
        contactPerson: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSupplier(id, data);
        return { success: true };
      }),
    
    // 删除供应商
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSupplier(input.id);
        return { success: true };
      }),
    
    // 上传供应商映射表
    uploadMapping: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const buffer = Buffer.from(input.fileBase64, 'base64');
          const mappings = parseSupplierMappingExcel(buffer);
          
          // 获取或创建供应商
          const existingSuppliers = await db.getSuppliersByUserId(ctx.user.id);
          const supplierMap = new Map<string, number>();
          
          for (const supplier of existingSuppliers) {
            supplierMap.set(supplier.supplierName, supplier.id);
          }
          
          // 创建新供应商并建立映射
          let createdCount = 0;
          let mappingCount = 0;
          
          for (const mapping of mappings) {
            let supplierId = supplierMap.get(mapping.supplierName);
            
            if (!supplierId) {
              // 创建新供应商
              supplierId = Number(await db.createSupplier({
                userId: ctx.user.id,
                supplierName: mapping.supplierName,
                contactPerson: mapping.contactPerson || null,
                email: mapping.email || null,
                phone: mapping.phone || null,
                notes: mapping.notes || null,
              }));
              supplierMap.set(mapping.supplierName, supplierId);
              createdCount++;
            }
            
            // 删除旧映射
            await db.deleteMaterialSupplierMappingsByMaterialCode(ctx.user.id, mapping.materialCode);
            
            // 创建新映射
            await db.createMaterialSupplierMapping({
              userId: ctx.user.id,
              materialCode: mapping.materialCode,
              supplierId,
            });
            mappingCount++;
          }
          
          return {
            success: true,
            createdSuppliers: createdCount,
            mappingCount,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '文件解析失败',
          });
        }
      }),
  }),

  // 物料-供应商映射管理
  mapping: router({
    // 获取所有映射
    list: protectedProcedure.query(async ({ ctx }) => {
      const mappings = await db.getMaterialSupplierMappingsByUserId(ctx.user.id);
      const suppliers = await db.getSuppliersByUserId(ctx.user.id);
      
      const supplierMap = new Map(suppliers.map(s => [s.id, s]));
      
      return mappings.map(m => ({
        ...m,
        supplier: supplierMap.get(m.supplierId),
      }));
    }),
    
    // 创建或更新映射
    upsert: protectedProcedure
      .input(z.object({
        materialCode: z.string(),
        supplierId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 删除旧映射
        await db.deleteMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
        
        // 创建新映射
        const mappingId = await db.createMaterialSupplierMapping({
          userId: ctx.user.id,
          materialCode: input.materialCode,
          supplierId: input.supplierId,
        });
        
        return { mappingId: Number(mappingId) };
      }),
    
    // 删除映射
    delete: protectedProcedure
      .input(z.object({ materialCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
        return { success: true };
      }),
  }),

  // 邮件生成
  email: router({
    // 生成所有供应商的邮件
    generateAll: protectedProcedure
      .input(z.object({
        planId: z.number(),
        companyName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getMaterialPlanById(input.planId);
        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '物料计划不存在',
          });
        }
        
        const items = await db.getMaterialItemsByPlanId(input.planId);
        const suppliers = await db.getSuppliersByUserId(ctx.user.id);
        const mappings = await db.getMaterialSupplierMappingsByUserId(ctx.user.id);
        
        // 按供应商分组物料
        const supplierMaterialsMap = new Map<number, typeof items>();
        
        for (const mapping of mappings) {
          const material = items.find(item => item.materialCode === mapping.materialCode);
          if (material) {
            if (!supplierMaterialsMap.has(mapping.supplierId)) {
              supplierMaterialsMap.set(mapping.supplierId, []);
            }
            supplierMaterialsMap.get(mapping.supplierId)!.push(material);
          }
        }
        
        // 删除旧的邮件记录
        await db.deleteGeneratedEmailsByPlanId(input.planId);
        
        // 生成邮件
        const generatedEmails = [];
        
        for (const supplier of suppliers) {
          const materials = supplierMaterialsMap.get(supplier.id);
          if (!materials || materials.length === 0) continue;
          
          const email = generateSupplierEmail(
            supplier,
            materials,
            plan.planStartDate,
            plan.planEndDate,
            input.companyName
          );
          
          await db.createGeneratedEmail({
            planId: input.planId,
            supplierId: supplier.id,
            emailSubject: email.subject,
            emailBody: email.body,
          });
          
          generatedEmails.push({
            supplierId: supplier.id,
            supplierName: supplier.supplierName,
            email: supplier.email || '',
            subject: email.subject,
            body: email.body,
            materialCount: materials.length,
          });
        }
        
        return {
          success: true,
          emailCount: generatedEmails.length,
          emails: generatedEmails,
        };
      }),
    
    // 获取已生成的邮件
    getByPlanId: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ ctx, input }) => {
        const emails = await db.getGeneratedEmailsByPlanId(input.planId);
        const suppliers = await db.getSuppliersByUserId(ctx.user.id);
        
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));
        
        return emails.map(e => ({
          ...e,
          supplier: supplierMap.get(e.supplierId),
        }));
      }),
    
    // 导出CSV
    exportCSV: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ ctx, input }) => {
        const emails = await db.getGeneratedEmailsByPlanId(input.planId);
        const suppliers = await db.getSuppliersByUserId(ctx.user.id);
        
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));
        
        const emailData = emails.map(e => {
          const supplier = supplierMap.get(e.supplierId);
          return {
            supplierName: supplier?.supplierName || '',
            email: supplier?.email || '',
            subject: e.emailSubject,
            body: e.emailBody,
          };
        });
        
        const csv = generateEmailCSV(emailData);
        
        return {
          csv,
          filename: `邮件发送清单_${new Date().toISOString().split('T')[0]}.csv`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
