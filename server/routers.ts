import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as supplierAuthDb from "./supplierAuth";
import { parseMaterialPlanExcel, parseSupplierMappingExcel } from "./excelParser";
import { generateSupplierEmail, generateEmailCSV } from "./emailGenerator";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";
import { SUPPLIER_COOKIE_NAME } from "@shared/const";
import { generateModificationExcel } from "./modificationExporter";

export const appRouter = router({
  system: systemRouter,
  
  // 通知中心
  notifications: router({
    // 获取通知列表
    getList: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional())
      .query(async ({ ctx, input }) => {
        const limit = input?.limit || 50;
        return await db.getNotificationsByUserId(ctx.user.id, limit);
      }),
    
    // 获取未读数量
    getUnreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUnreadNotificationCount(ctx.user.id);
      }),
    
    // 标记为已读
    markAsRead: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.markNotificationAsRead(input.id, ctx.user.id);
      }),
    
    // 标记全部为已读
    markAllAsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        return await db.markAllNotificationsAsRead(ctx.user.id);
      }),
    
    // 删除通知
    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteNotification(input.id, ctx.user.id);
      }),
  }),
  
  // 仪表盘统计
  dashboard: router({
    getStats: protectedProcedure
      .query(async ({ ctx }) => {
        const [dataStats, confirmStats] = await Promise.all([
          db.getUserDataStats(ctx.user.id),
          db.getConfirmationStatsByUserId(ctx.user.id),
        ]);
        
        return {
          materialPlans: dataStats.materialPlans,
          suppliers: dataStats.suppliers,
          emailsSent: dataStats.emailLogs,
          pendingConfirmations: confirmStats.pending,
        };
      }),
    
    // 获取供应商确认状态统计
    getSupplierConfirmationStats: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getSupplierConfirmationStats(ctx.user.id);
      }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    // 用户注册
    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 检查用户名是否已存在
        const existingUser = await db.getUserByUsername(input.username);
        if (existingUser) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '用户名已存在',
          });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(input.password, 10);
        
        // 创建用户
        await db.createUser({
          username: input.username,
          password: hashedPassword,
          name: input.name,
          email: input.email,
        });
        
        return {
          success: true,
          message: '注册成功',
        };
      }),
    
    // 用户登录
    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
        rememberMe: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 查找用户
        const user = await db.getUserByUsername(input.username);
        if (!user || !user.password) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '用户名或密码错误',
          });
        }
        
        // 验证密码
        const isValid = await bcrypt.compare(input.password, user.password);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '用户名或密码错误',
          });
        }
        
        // 更新最后登录时间
        await db.updateUserLastSignedIn(user.id);
        
        // 生成JWT token
        const maxAge = input.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30天或7天
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          ENV.jwtSecret,
          { expiresIn: maxAge / 1000 }
        );
        
        // 设置cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge,
        });
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),
    
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
    // 获取所有供应商（可选按物料计划过滤）
    list: protectedProcedure
      .input(z.object({ planId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.planId) {
          // 如果指定了planId，只返回该计划中有物料的供应商
          return await db.getSuppliersByPlanId(ctx.user.id, input.planId);
        }
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
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        // 验证供应商是否属于当前用户
        const supplier = await db.getSupplierById(id);
        if (!supplier || supplier.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权限操作此供应商' });
        }
        await db.updateSupplier(id, data);
        return { success: true };
      }),
    
    // 删除供应商
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 验证供应商是否属于当前用户
        const supplier = await db.getSupplierById(input.id);
        if (!supplier || supplier.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权限操作此供应商' });
        }
        await db.deleteSupplier(input.id);
        return { success: true };
      }),
    
    // 更新供应商邮箱
    updateEmail: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        email: z.string().email('请输入有效的邮箱地址'),
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证供应商是否属于当前用户
        const supplier = await db.getSupplierById(input.id);
        if (!supplier || supplier.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权限操作此供应商' });
        }
        await db.updateSupplierEmail(input.id, input.email);
        return { success: true };
      }),
    
    // 下载邮箱导入模板
    downloadEmailTemplate: protectedProcedure
      .query(async () => {
        const { generateEmailImportTemplate } = await import('./templateGenerator');
        const buffer = generateEmailImportTemplate();
        return {
          fileBase64: buffer.toString('base64'),
          filename: '供应商邮箱导入模板.xlsx'
        };
      }),

    // 批量导入供应商邮箱
    importEmails: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const buffer = Buffer.from(input.fileBase64, 'base64');
          const XLSX = require('xlsx');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);

          const existingSuppliers = await db.getSuppliersByUserId(ctx.user.id);
          const supplierMap = new Map<string, number>();
          
          for (const supplier of existingSuppliers) {
            supplierMap.set(supplier.supplierName.trim(), supplier.id);
          }

          const successList: string[] = [];
          const failedList: string[] = [];
          const skippedList: string[] = [];

          for (const row of data as any[]) {
            const supplierName = row['供应商名称'] || row['supplierName'] || row['名称'];
            const email = row['邮箱'] || row['email'] || row['Email'];

            if (!supplierName || !email) {
              skippedList.push(`缺少供应商名称或邮箱`);
              continue;
            }

            const supplierId = supplierMap.get(supplierName.trim());
            if (supplierId) {
              await db.updateSupplier(supplierId, { email: email.trim() });
              successList.push(supplierName.trim());
            } else {
              failedList.push(supplierName.trim());
            }
          }

          return {
            success: true,
            updatedCount: successList.length,
            totalCount: data.length,
            successList,
            failedList,
            skippedList,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '文件解析失败',
          });
        }
      }),

    // 上传供应商映射表
    uploadMapping: protectedProcedure
      .input(z.object({
        planId: z.number(),
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
              planId: input.planId,
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
    
    // 分页获取物料列表（优化版）
    listPaginated: protectedProcedure
      .input(z.object({
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ ctx, input }) => {
        const result = await db.getMaterialSupplierMappingsPaginated(
          ctx.user.id,
          input.page,
          input.pageSize
        );
        
        const suppliers = await db.getSuppliersByUserId(ctx.user.id);
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));
        
        const materialsWithSuppliers = result.materials.map(material => ({
          ...material,
          mappings: material.mappings.map(m => ({
            ...m,
            supplier: supplierMap.get(m.supplierId),
          })),
        }));
        
        return {
          materials: materialsWithSuppliers,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        };
      }),
    
    // 创建或更新映射（支持多供应商）
    upsert: protectedProcedure
      .input(z.object({
        planId: z.number(),
        materialCode: z.string(),
        suppliers: z.array(z.object({
          supplierId: z.number(),
          sharePercentage: z.number().min(0).max(100),
          priority: z.number().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证份额总和
        const totalShare = input.suppliers.reduce((sum, s) => sum + s.sharePercentage, 0);
        if (Math.abs(totalShare - 100) > 0.01 && input.suppliers.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `供应商份额总和必须为100%，当前为${totalShare.toFixed(2)}%`,
          });
        }
        
        // 获取旧映射用于记录历史
        const oldMappings = await db.getMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
        const oldMappingMap = new Map(oldMappings.map(m => [m.supplierId, m.sharePercentage]));
        
        // 删除旧映射
        await db.deleteMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
        
        // 创建新映射并记录历史
        const mappingIds = [];
        for (let i = 0; i < input.suppliers.length; i++) {
          const supplier = input.suppliers[i];
          const newShare = supplier.sharePercentage.toFixed(2);
          const oldShare = oldMappingMap.get(supplier.supplierId);
          
          // 记录份额变更
          if (oldShare !== newShare) {
            await db.recordShareChange(
              ctx.user.id,
              input.materialCode,
              supplier.supplierId,
              oldShare || null,
              newShare
            );
          }
          
          const mappingId = await db.createMaterialSupplierMapping({
            planId: input.planId,
            userId: ctx.user.id,
            materialCode: input.materialCode,
            supplierId: supplier.supplierId,
            sharePercentage: newShare,
            priority: supplier.priority || (i + 1),
          });
          mappingIds.push(Number(mappingId));
        }
        
        return { mappingIds };
      }),
    
    // 删除映射
    delete: protectedProcedure
      .input(z.object({ 
        materialCode: z.string(),
        supplierId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.supplierId) {
          // 删除特定供应商的映射
          const mappings = await db.getMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
          const targetMapping = mappings.find(m => m.supplierId === input.supplierId);
          if (targetMapping) {
            await db.deleteMaterialSupplierMapping(targetMapping.id);
          }
        } else {
          // 删除所有映射
          await db.deleteMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
        }
        return { success: true };
      }),
    
    // 获取供应商统计信息
    getSupplierStats: protectedProcedure
      .input(z.object({ supplierId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getSupplierPurchaseStats(ctx.user.id, input.supplierId);
      }),
    
    // 获取份额变更历史
    getChangeHistory: protectedProcedure
      .input(z.object({ materialCode: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getShareChangeHistory(ctx.user.id, input.materialCode);
      }),
    
    // 获取特定物料的映射
    getByMaterialCode: protectedProcedure
      .input(z.object({ materialCode: z.string() }))
      .query(async ({ ctx, input }) => {
        const mappings = await db.getMaterialSupplierMappingsByMaterialCode(ctx.user.id, input.materialCode);
        const suppliers = await db.getSuppliersByUserId(ctx.user.id);
        
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));
        
        return mappings.map(m => ({
          ...m,
          supplier: supplierMap.get(m.supplierId),
        }));
      }),
    
    // 新API: 按计划获取物料及其供应商分配（分页）
    listByPlan: protectedProcedure
      .input(z.object({
        planId: z.number(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(100).default(50),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getMaterialsWithSuppliersByPlan(
          input.planId,
          input.page,
          input.pageSize
        );
      }),
    
    // 新API: 按计划和物料代码获取供应商分配详情
    getByPlanAndMaterial: protectedProcedure
      .input(z.object({
        planId: z.number(),
        materialCode: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getMaterialSupplierAllocationDetail(
          input.planId,
          input.materialCode
        );
      }),
    
    // 新API: 更新物料的供应商份额分配
    updateShares: protectedProcedure
      .input(z.object({
        planId: z.number(),
        materialCode: z.string(),
        shares: z.array(z.object({
          supplierId: z.number(),
          sharePercentage: z.number().min(0).max(100),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const updatedCount = await db.updateMaterialSupplierShares(
            input.materialCode,
            input.shares,
            ctx.user.id,
            input.planId
          );
          return {
            success: true,
            updatedCount,
          };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '更新失败',
          });
        }
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
        
        // 按供应商分组物料，并计算份额分配后的数量
        const supplierMaterialsMap = new Map<number, Array<typeof items[0] & { allocatedDemand?: number; sharePercentage?: string }>>();
        
        for (const mapping of mappings) {
          const material = items.find(item => item.materialCode === mapping.materialCode);
          if (material) {
            if (!supplierMaterialsMap.has(mapping.supplierId)) {
              supplierMaterialsMap.set(mapping.supplierId, []);
            }
            
            // 计算该供应商应分配的数量
            const demand = material.demand ? parseFloat(material.demand) : 0;
            const sharePercentage = parseFloat(mapping.sharePercentage || "100");
            const allocatedDemand = Math.round(demand * sharePercentage / 100);
            
            supplierMaterialsMap.get(mapping.supplierId)!.push({
              ...material,
              allocatedDemand,
              sharePercentage: mapping.sharePercentage,
            });
          }
        }
        
        // 删除旧的邮件记录
        await db.deleteGeneratedEmailsByPlanId(input.planId);
        
        // 生成邮件
        const generatedEmails = [];
        
        for (const supplier of suppliers) {
          const materials = supplierMaterialsMap.get(supplier.id);
          if (!materials || materials.length === 0) continue;
          
          const email = await generateSupplierEmail(
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
    
    // 发送邮件给供应商
    send: protectedProcedure
      .input(z.object({
        planId: z.number(),
        supplierId: z.number(),
        recipientEmail: z.string().email(),
        subject: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sendEmail, sendEmailWithAccount } = await import('./emailService');
        const { generateSupplierEmail } = await import('./emailGenerator');
        
        // 获取计划和供应商信息
        const plan = await db.getMaterialPlanById(input.planId);
        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '计划不存在',
          });
        }
        
        const supplier = await db.getSupplierById(input.supplierId);
        if (!supplier) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '供应商不存在',
          });
        }
        
        // 获取该供应商的物料列表
        const items = await db.getMaterialItemsByPlanId(input.planId);
        const mappings = await db.getMaterialSupplierMappingsByUserId(ctx.user.id);
        
        // 筛选出该供应商的物料
        const materials = [];
        for (const mapping of mappings) {
          if (mapping.supplierId === input.supplierId) {
            const material = items.find(item => item.materialCode === mapping.materialCode);
            if (material) {
              const demand = material.demand ? parseFloat(material.demand) : 0;
              const sharePercentage = parseFloat(mapping.sharePercentage || "100");
              const allocatedDemand = Math.round(demand * sharePercentage / 100);
              
              materials.push({
                ...material,
                allocatedDemand,
                sharePercentage: mapping.sharePercentage,
              });
            }
          }
        }
        
        // 创建发送记录（先创建以获取logId）
        const logId = await db.createEmailSendLog({
          userId: ctx.user.id,
          planId: input.planId,
          supplierId: input.supplierId,
          recipientEmail: input.recipientEmail,
          subject: input.subject,
          content: input.content,
          status: "pending",
        });

        // 创建供应商确认记录并生成确认链接
        const { generateConfirmToken, calculateExpiryDate, generateConfirmationUrl } = await import('./confirmationService');
        const token = generateConfirmToken();
        const expiresAt = calculateExpiryDate(30);
        
        // 检查是否已存在该计划和供应商的确认记录
        const existingConfirmation = await db.getExistingConfirmation(input.planId, input.supplierId);
        if (existingConfirmation) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '该供应商已有一条该计划的确认记录',
          });
        }

        // 计算该供应商的日期维度来货数量
        const supplierDailySchedule: Record<string, number> = {};
        for (const material of materials) {
          const schedule = material.dailySchedule || {};
          const sharePercentage = parseFloat(material.sharePercentage || "100");
          
          for (const [date, qty] of Object.entries(schedule)) {
            const allocatedQty = Math.round(qty * sharePercentage / 100);
            if (allocatedQty > 0) {
              supplierDailySchedule[date] = (supplierDailySchedule[date] || 0) + allocatedQty;
            }
          }
        }

        await db.createSupplierConfirmation({
          userId: ctx.user.id,
          planId: input.planId,
          supplierId: input.supplierId,
          emailLogId: Number(logId),
          confirmToken: token,
          expiresAt,
          status: 'pending', // 显式指定初始状态
          dailySchedule: supplierDailySchedule,
        } as any);
        
        // 生成确认链接URL
        // 从请求头中获取实际的域名
        const protocol = ctx.req.headers['x-forwarded-proto'] || ctx.req.protocol || 'https';
        const host = ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;
        const confirmUrl = generateConfirmationUrl(token, baseUrl);
        
        // 重新生成邮件内容（包含Excel附件和确认链接）
        const emailContent = await generateSupplierEmail(
          supplier,
          materials,
          plan.planStartDate,
          plan.planEndDate,
          "贵司",
          confirmUrl
        );
        
        // 更新发送记录的邮件内容
        await db.updateEmailSendLog(Number(logId), {
          subject: emailContent.subject,
          content: emailContent.body,
        });

        // 获取默认SMTP账号
        const smtpAccount = await db.getDefaultSmtpAccount(ctx.user.id);
        
        // 发送邮件（带附件）
        let result;
        if (smtpAccount) {
          // 使用数据库中的SMTP账号
          result = await sendEmailWithAccount(
            {
              to: input.recipientEmail,
              subject: emailContent.subject,
              html: emailContent.body,
              attachments: emailContent.attachment ? [emailContent.attachment] : undefined,
            },
            smtpAccount
          );
        } else {
          // 使用环境变量配置
          result = await sendEmail({
            to: input.recipientEmail,
            subject: emailContent.subject,
            html: emailContent.body,
            attachments: emailContent.attachment ? [emailContent.attachment] : undefined,
          });
        }

        // 更新发送状态
        await db.updateEmailSendLogStatus(
          Number(logId),
          result.success ? "sent" : "failed",
          result.error
        );

        return {
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        };
      }),

    // 批量发送邮件
    sendBatch: protectedProcedure
      .input(z.object({
        planId: z.number(),
        emails: z.array(z.object({
          supplierId: z.number(),
          recipientEmail: z.string().email(),
          subject: z.string(),
          content: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sendEmail, sendEmailWithAccount } = await import('./emailService');
        const results = [];

        for (const email of input.emails) {
          // 发送邮件
          const emailResult = await sendEmail({
            to: email.recipientEmail,
            subject: email.subject,
            html: email.content,
          });

          results.push({
            supplierId: email.supplierId,
            success: emailResult.success,
            error: emailResult.error,
          });
        }

        return {
          total: input.emails.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results,
        };
      }),

    // 获取邮件发送历史
    getSendHistory: protectedProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEmailSendLogsByPlanId(input.planId);
      }),
  }),

  // 采购订单导入
  purchaseOrder: router({
    // 解析采购订单并计算份额
    parseAndCalculate: protectedProcedure
      .input(z.object({
        fileContent: z.string(), // base64 encoded
      }))
      .mutation(async ({ ctx, input }) => {
        const { parsePurchaseOrderExcel, calculateSupplierShares, extractUniqueSuppliers } = await import('./purchaseOrderParser');
        
        // 解码base64
        const buffer = Buffer.from(input.fileContent, 'base64');
        
        // 解析Excel
        const orders = parsePurchaseOrderExcel(buffer);
        
        // 计算份额
        const calculations = calculateSupplierShares(orders);
        
        // 提取供应商列表
        const uniqueSuppliers = extractUniqueSuppliers(orders);
        
        return {
          success: true,
          orderCount: orders.length,
          materialCount: calculations.length,
          supplierCount: uniqueSuppliers.length,
          calculations,
          suppliers: uniqueSuppliers,
        };
      }),
    
    // 应用计算结果（创建供应商和映射）
    applyCalculations: protectedProcedure
      .input(z.object({
        planId: z.number(),
        calculations: z.array(z.object({
          materialCode: z.string(),
          materialName: z.string(),
          suppliers: z.array(z.object({
            supplierName: z.string(),
            sharePercentage: z.number(),
          })),
        })),
        createMissingSuppliers: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const existingSuppliers = await db.getSuppliersByUserId(ctx.user.id);
        const supplierMap = new Map(existingSuppliers.map(s => [s.supplierName, s.id]));
        
        let createdSuppliers = 0;
        let createdMappings = 0;
        
        // 创建缺失的供应商
        if (input.createMissingSuppliers) {
          const allSupplierNames = new Set<string>();
          for (const calc of input.calculations) {
            for (const supplier of calc.suppliers) {
              allSupplierNames.add(supplier.supplierName);
            }
          }
          
          for (const supplierName of Array.from(allSupplierNames)) {
            if (!supplierMap.has(supplierName)) {
              const supplierId = await db.createSupplier({
                userId: ctx.user.id,
                supplierName,
              });
              supplierMap.set(supplierName, Number(supplierId));
              createdSuppliers++;
            }
          }
        }
        
        // 创建映射
        for (const calc of input.calculations) {
          // 删除旧映射
          await db.deleteMaterialSupplierMappingsByMaterialCode(ctx.user.id, calc.materialCode);
          
          // 创建新映射
          for (let i = 0; i < calc.suppliers.length; i++) {
            const supplier = calc.suppliers[i];
            const supplierId = supplierMap.get(supplier.supplierName);
            
            if (supplierId) {
              await db.createMaterialSupplierMapping({
                planId: input.planId,
                userId: ctx.user.id,
                materialCode: calc.materialCode,
                supplierId,
                sharePercentage: supplier.sharePercentage.toFixed(2),
                priority: i + 1,
              });
              createdMappings++;
            }
          }
        }
        
        return {
          success: true,
          createdSuppliers,
          createdMappings,
        };
      }),
  }),

  // 数据重置
  dataReset: router({
    // 获取用户数据统计
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserDataStats(ctx.user.id);
    }),

    // 重置数据
    reset: protectedProcedure
      .input(z.object({
        resetMaterialPlans: z.boolean().optional(),
        resetSuppliers: z.boolean().optional(),
        resetMappings: z.boolean().optional(),
        resetEmails: z.boolean().optional(),
        resetEmailLogs: z.boolean().optional(),
        resetConfirmations: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = await db.resetUserData(ctx.user.id, input);
        return {
          success: true,
          results,
        };
      }),
  }),

  // 供应商确认跟踪系统
  confirmation: router({
    // 根据token获取确认信息（公开接口，供应商无需登录）
    getByToken: publicProcedure
      .input(z.object({
        token: z.string(),
      }))
      .query(async ({ input }) => {
        const confirmation = await db.getConfirmationByToken(input.token);
        
        if (!confirmation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '确认记录不存在',
          });
        }

        // 检查是否过期
        const { isTokenExpired } = await import('./confirmationService');
        if (isTokenExpired(confirmation.expiresAt)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '确认链接已过期',
          });
        }

        // 获取关联的供应商和物料计划信息
        const supplier = await db.getSupplierById(confirmation.supplierId);
        const plan = await db.getMaterialPlanById(confirmation.planId);
        const allItems = plan ? await db.getMaterialItemsByPlanId(plan.id) : [];
        
        // 获取该供应商的物料映射
        const mappings = await db.getMaterialSupplierMappingsByUserId(confirmation.userId);
        
        // 筛选出该供应商负责的物料
        const supplierMaterialCodes = new Set(
          mappings
            .filter(m => m.supplierId === confirmation.supplierId)
            .map(m => m.materialCode)
        );
        
        // 创建物料代码到份额的映射
        const shareMap = new Map<string, string>();
        mappings
          .filter(m => m.supplierId === confirmation.supplierId)
          .forEach(m => {
            shareMap.set(m.materialCode, m.sharePercentage || "100");
          });
        
        const items = allItems
          .filter(item => supplierMaterialCodes.has(item.materialCode))
          .map(item => {
            // 根据供应商份额重新计算dailySchedule
            const sharePercentage = parseFloat(shareMap.get(item.materialCode) || "100");
            const originalSchedule = item.dailySchedule || {};
            
            const allocatedSchedule: Record<string, number> = {};
            for (const [date, qty] of Object.entries(originalSchedule)) {
              allocatedSchedule[date] = Math.round(qty * sharePercentage / 100);
            }
            
            return {
              ...item,
              dailySchedule: allocatedSchedule,
            };
          });

        return {
          confirmation,
          supplier,
          plan,
          items,
        };
      }),

    // 更新生产状态（公开接口，供应商可更新）
    updateProductionStatus: publicProcedure
      .input(z.object({
        token: z.string(),
        productionStatus: z.enum(['not_started', 'material_prep', 'in_production', 'in_qc', 'ready_to_ship', 'shipped']),
      }))
      .mutation(async ({ input }) => {
        const confirmation = await db.getConfirmationByToken(input.token);
        
        if (!confirmation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '确认记录不存在',
          });
        }

        // 检查是否过期
        const { isTokenExpired } = await import('./confirmationService');
        if (isTokenExpired(confirmation.expiresAt)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '确认链接已过期',
          });
        }

        // 更新生产状态
        await db.updateConfirmationProductionStatus(confirmation.id, input.productionStatus);

        // 创建通知
        const supplier = await db.getSupplierById(confirmation.supplierId);
        const statusMap: Record<string, string> = {
          'not_started': '未开始',
          'material_prep': '原料准备中',
          'in_production': '生产中',
          'in_qc': '质检中',
          'ready_to_ship': '待发货',
          'shipped': '已发货',
        };
        await db.createNotification({
          userId: confirmation.userId,
          type: 'status_change',
          title: `供应商${supplier?.supplierName || ''}更新了生产状态`,
          content: `供应商${supplier?.supplierName || ''}将生产状态更新为：${statusMap[input.productionStatus]}`,
          relatedId: confirmation.id,
          relatedType: 'confirmation',
        });

        return {
          success: true,
          message: '生产状态更新成功',
        };
      }),

    // 供应商提交确认响应（公开接口）
    submit: publicProcedure
      .input(z.object({
        token: z.string(),
        status: z.enum(['confirmed', 'partial', 'rejected', 'modified']),
        supplierResponse: z.string().optional(), // JSON字符串
        supplierNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const confirmation = await db.getConfirmationByToken(input.token);
        
        if (!confirmation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '确认记录不存在',
          });
        }

        // 检查是否过期
        const { isTokenExpired } = await import('./confirmationService');
        if (isTokenExpired(confirmation.expiresAt)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '确认链接已过期',
          });
        }

        // 更新确认状态
        await db.updateConfirmationStatus(confirmation.id, {
          status: input.status,
          supplierResponse: input.supplierResponse,
          supplierNotes: input.supplierNotes,
          confirmedAt: new Date(),
        });

        // 创建通知
        const supplier = await db.getSupplierById(confirmation.supplierId);
        const statusText = input.status === 'confirmed' ? '已确认' : input.status === 'rejected' ? '已拒绝' : '部分确认';
        await db.createNotification({
          userId: confirmation.userId,
          type: 'supplier_reply',
          title: `供应商${supplier?.supplierName || ''}回复了计划`,
          content: `供应商${supplier?.supplierName || ''}已${statusText}物料计划${input.supplierNotes ? `，备注：${input.supplierNotes}` : ''}`,
          relatedId: confirmation.id,
          relatedType: 'confirmation',
        });

        return {
          success: true,
          message: '确认提交成功',
        };
      }),

    // 供应商提交修改的交期数量（公开接口）
    submitModifications: publicProcedure
      .input(z.object({
        token: z.string(),
        modifications: z.array(z.object({
          materialCode: z.string(),
          originalSchedule: z.record(z.string(), z.number()),
          modifiedSchedule: z.record(z.string(), z.number()),
          modificationReason: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const confirmation = await db.getConfirmationByToken(input.token);
        
        if (!confirmation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '确认记录不存在',
          });
        }

        // 检查是否过期
        const { isTokenExpired } = await import('./confirmationService');
        if (isTokenExpired(confirmation.expiresAt)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '确认链接已过期',
          });
        }

        // 保存所有修改历史
        for (const mod of input.modifications) {
          await db.saveConfirmationModification({
            confirmationId: confirmation.id,
            materialCode: mod.materialCode,
            originalSchedule: mod.originalSchedule,
            modifiedSchedule: mod.modifiedSchedule,
            modificationReason: mod.modificationReason,
          });
        }

        // 更新确认状态为modified
        await db.updateConfirmationStatus(confirmation.id, {
          status: 'modified',
          confirmedAt: new Date(),
        });

        // 创建通知
        const supplier = await db.getSupplierById(confirmation.supplierId);
        await db.createNotification({
          userId: confirmation.userId,
          type: 'status_change',
          title: `供应商${supplier?.supplierName || ''}修改了计划`,
          content: `供应商${supplier?.supplierName || ''}对${input.modifications.length}个物料的交期数量进行了修改，请及时查看`,
          relatedId: confirmation.id,
          relatedType: 'confirmation',
        });

        return {
          success: true,
          message: '修改提交成功',
        };
      }),

    // 获取物料计划的所有确认记录（需要登录）
    getByPlanId: protectedProcedure
      .input(z.object({
        planId: z.number(),
      }))
      .query(async ({ input }) => {
        const confirmations = await db.getConfirmationsByPlanId(input.planId);
        return confirmations;
      }),

    // 获取确认统计（需要登录）
    getStats: protectedProcedure
      .query(async ({ ctx }) => {
        const stats = await db.getConfirmationStatsByUserId(ctx.user.id);
        return stats;
      }),

    // 获取修改历史记录（需要登录）
    getModifications: protectedProcedure
      .input(z.object({
        planId: z.number(),
      }))
      .query(async ({ input }) => {
        const modifications = await db.getModificationsByPlanId(input.planId);
        return modifications;
      }),

    // 导出修改历史为Excel（需要登录）
    exportModifications: protectedProcedure
      .input(z.object({
        confirmationId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const modifications = await db.getModificationsByConfirmationId(input.confirmationId);
        if (modifications.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "没有找到修改记录",
          });
        }
        
        const confirmation = await db.getConfirmationById(input.confirmationId);
        const supplierName = confirmation?.supplier?.supplierName || "供应商";
        
        const excelBuffer = await generateModificationExcel(modifications, supplierName);
        const base64 = excelBuffer.toString("base64");
        const fileName = `${supplierName}_修改历史_${new Date().toISOString().split("T")[0]}.xlsx`;
        
        return {
          fileName,
          base64,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }),

    // 创建确认记录（需要登录）
    create: protectedProcedure
      .input(z.object({
        planId: z.number(),
        supplierId: z.number(),
        emailLogId: z.number().optional(),
        expiryDays: z.number().default(30),
      }))
      .mutation(async ({ ctx, input }) => {
        const { generateConfirmToken, calculateExpiryDate } = await import('./confirmationService');
        
        const token = generateConfirmToken();
        const expiresAt = calculateExpiryDate(input.expiryDays);

        const confirmationId = await db.createSupplierConfirmation({
          userId: ctx.user.id,
          planId: input.planId,
          supplierId: input.supplierId,
          emailLogId: input.emailLogId,
          confirmToken: token,
          expiresAt,
        });

        const { generateConfirmationUrl } = await import('./confirmationService');
        const confirmUrl = generateConfirmationUrl(token);

        return {
          confirmationId: Number(confirmationId),
          token,
          confirmUrl,
          expiresAt,
        };
      }),
  }),

  // SMTP邮箱配置管理
  smtp: router({    // 获取所有SMTP账号
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const accounts = await db.getSmtpAccountsByUserId(ctx.user.id);
        // 不返回密码字段
        return accounts.map(({ smtpPassword, ...account }) => account);
      }),

    // 获取默认SMTP账号
    getDefault: protectedProcedure
      .query(async ({ ctx }) => {
        const account = await db.getDefaultSmtpAccount(ctx.user.id);
        if (!account) {
          return null;
        }
        // 不返回密码字段
        const { smtpPassword, ...accountWithoutPassword } = account;
        return accountWithoutPassword;
      }),

    // 创建SMTP账号
    create: protectedProcedure
      .input(z.object({
        accountName: z.string().min(1, "账号名称不能为空"),
        smtpHost: z.string().min(1, "SMTP服务器地址不能为空"),
        smtpPort: z.number().int().positive("端口必须为正整数"),
        smtpSecure: z.boolean().default(true),
        smtpUser: z.string().min(1, "SMTP用户名不能为空"),
        smtpPassword: z.string().min(1, "SMTP密码不能为空"),
        fromEmail: z.string().email("发件人邮箱格式不正确"),
        fromName: z.string().optional(),
        isDefault: z.boolean().default(false),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createSmtpAccount({
          ...input,
          userId: ctx.user.id,
        });

        return {
          success: true,
          message: "SMTP账号创建成功",
        };
      }),

    // 更新SMTP账号
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        accountName: z.string().min(1).optional(),
        smtpHost: z.string().min(1).optional(),
        smtpPort: z.number().int().positive().optional(),
        smtpSecure: z.boolean().optional(),
        smtpUser: z.string().min(1).optional(),
        smtpPassword: z.string().min(1).optional(),
        fromEmail: z.string().email().optional(),
        fromName: z.string().optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateSmtpAccount(id, ctx.user.id, data);

        return {
          success: true,
          message: "SMTP账号更新成功",
        };
      }),

    // 删除SMTP账号
    delete: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteSmtpAccount(input.id, ctx.user.id);

        return {
          success: true,
          message: "SMTP账号删除成功",
        };
      }),

    // 设置默认SMTP账号
    setDefault: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.setDefaultSmtpAccount(input.id, ctx.user.id);

        return {
          success: true,
          message: "已设置为默认账号",
        };
      }),
  }),

  // ERP实际到货导入
  erp: router({
    // 导入ERP实际到货Excel
    importData: protectedProcedure
      .input(z.object({
        fileContent: z.string(), // Base64编码的Excel文件
      }))
      .mutation(async ({ ctx, input }) => {
        const { parseActualReceiptExcel } = await import("./erpParser");
        
        // 解析Excel
        const receipts = await parseActualReceiptExcel(input.fileContent);
        
        // 添加userId
        const receiptsWithUserId = receipts.map(receipt => ({
          userId: ctx.user.id,
          materialCode: receipt.materialCode,
          businessDate: receipt.businessDate,
          actualQuantity: receipt.actualQuantity.toString(), // decimal类型需要字符串
          supplierName: receipt.supplierName || null,
        }));
        
        // 保存到数据库
        await db.createActualReceipts(receiptsWithUserId);
        
        return {
          success: true,
          message: `成功导入${receipts.length}条到货记录`,
          count: receipts.length,
        };
      }),

    // 获取实际到货记录
    getReceipts: protectedProcedure
      .query(async ({ ctx }) => {
        const receipts = await db.getActualReceiptsByUserId(ctx.user.id);
        return receipts;
      }),

    // 删除实际到货记录
    deleteReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteActualReceipt(input.id, ctx.user.id);
        return {
          success: true,
          message: "删除成功",
        };
      }),

    // 获取供应商逾期统计
    getOverdueAnalysis: protectedProcedure
      .query(async ({ ctx }) => {
        const analysis = await db.getSupplierOverdueAnalysis(ctx.user.id);
        return analysis;
      }),

    // 获取确认记录的实际到货信息
    getReceiptsForConfirmations: protectedProcedure
      .input(z.object({
        confirmationIds: z.array(z.number()),
      }))
      .query(async ({ ctx, input }) => {
        const receipts = await db.getActualReceiptsForConfirmations(
          ctx.user.id,
          input.confirmationIds
        );
        return receipts;
      }),

    // 获取供应商绩效报表
    getPerformanceReport: protectedProcedure
      .input(z.object({
        planId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const performanceStats = await db.getSupplierPerformanceStats(
          ctx.user.id,
          input.planId
        );
        const overdueRanking = await db.getOverdueRanking(
          ctx.user.id,
          input.planId
        );
        const onTimeRateTrend = await db.getOnTimeRateTrend(
          ctx.user.id,
          input.planId
        );
        return {
          performanceStats,
          overdueRanking,
          onTimeRateTrend,
        };
      }),

    // 获取供应商交付对比数据
    getSupplierDeliveryComparison: protectedProcedure
      .input(z.object({
        planId: z.number(),
        supplierId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const comparison = await db.getSupplierDeliveryComparison(
          ctx.user.id,
          input.planId,
          input.supplierId
        );
        return comparison;
      }),

    // 获取供应商详细差异对比数据
    getSupplierDetails: protectedProcedure
      .input(z.object({
        planId: z.number(),
        supplierName: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const details = await db.getSupplierDeliveryDetails(
          ctx.user.id,
          input.planId,
          input.supplierName
        );
        return details;
      }),
  }),

  // ============ 供应商认证和门户 ============
  
  // 供应商认证
  supplierAuth: router({
    // 供应商登录
    login: publicProcedure
      .input(z.object({
        supplierCode: z.string().min(1, "供应商编号不能为空"),
        pinCode: z.string().min(1, "PIN码不能为空"),
      }))
      .mutation(async ({ input, ctx }) => {
        const account = await supplierAuthDb.verifySupplierPin(input.supplierCode, input.pinCode);
        if (!account) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '供应商编号或PIN码错误',
          });
        }
        
        // 更新最后登录时间
        await supplierAuthDb.updateSupplierLastLogin(account.id);
        
        // 生成JWT token (30天有效期)
        const maxAge = 30 * 24 * 60 * 60 * 1000;
        const token = jwt.sign(
          { supplierAccountId: account.id, supplierId: account.supplierId, userId: account.userId },
          ENV.jwtSecret,
          { expiresIn: maxAge / 1000 }
        );
        
        // 设置cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(SUPPLIER_COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge,
        });
        
        return {
          success: true,
          isFirstLogin: account.isFirstLogin,
          supplierCode: account.supplierCode,
        };
      }),
    
    // 供应商登出
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(SUPPLIER_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    
    // 获取当前供应商信息
    me: publicProcedure.query(async ({ ctx }) => {
      const cookieHeader = ctx.req.headers.cookie || '';
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const [key, ...val] = c.trim().split('=');
          return [key, val.join('=')];
        })
      );
      const token = cookies[SUPPLIER_COOKIE_NAME];
      if (!token) return null;
      
      try {
        const decoded = jwt.verify(token, ENV.jwtSecret) as { supplierAccountId: number; supplierId: number; userId: number };
        const account = await supplierAuthDb.getSupplierAccountBySupplierId(decoded.supplierId);
        if (!account || !account.isActive) return null;
        
        // 获取供应商信息
        const supplierInfo = await db.getSupplierById(decoded.supplierId);
        
        return {
          id: account.id,
          supplierId: account.supplierId,
          userId: account.userId,
          supplierCode: account.supplierCode,
          supplierName: supplierInfo?.supplierName || '',
          isFirstLogin: account.isFirstLogin,
        };
      } catch {
        return null;
      }
    }),
    
    // 修改PIN码
    changePin: publicProcedure
      .input(z.object({
        oldPin: z.string().min(1),
        newPin: z.string().min(6, "PIN码至少6位"),
      }))
      .mutation(async ({ input, ctx }) => {
        // 从 cookie 获取供应商信息
        const cookieHeader = ctx.req.headers.cookie || '';
        const cookies = Object.fromEntries(
          cookieHeader.split(';').map(c => {
            const [key, ...val] = c.trim().split('=');
            return [key, val.join('=')];
          })
        );
        const token = cookies[SUPPLIER_COOKIE_NAME];
        if (!token) throw new TRPCError({ code: 'UNAUTHORIZED', message: '请先登录' });
        
        const decoded = jwt.verify(token, ENV.jwtSecret) as { supplierAccountId: number; supplierId: number };
        const account = await supplierAuthDb.getSupplierAccountByCode(
          (await supplierAuthDb.getSupplierAccountBySupplierId(decoded.supplierId))?.supplierCode || ''
        );
        if (!account) throw new TRPCError({ code: 'NOT_FOUND', message: '账号不存在' });
        
        // 验证旧PIN码
        const isValid = await bcrypt.compare(input.oldPin, account.pinCode);
        if (!isValid) throw new TRPCError({ code: 'BAD_REQUEST', message: '原PIN码错误' });
        
        // 更新PIN码
        await supplierAuthDb.updateSupplierPin(account.id, input.newPin);
        
        return { success: true, message: 'PIN码修改成功' };
      }),
  }),
  
  // 供应商门户数据
  supplierPortal: router({
    // 获取分配给供应商的物料列表
    getMaterials: publicProcedure.query(async ({ ctx }) => {
      const supplier = await getSupplierFromCookie(ctx);
      return await supplierAuthDb.getSupplierMaterials(supplier.supplierId, supplier.userId);
    }),
    
    // 获取交货计划（每日交货量网格）
    getDeliverySchedule: publicProcedure.query(async ({ ctx }) => {
      const supplier = await getSupplierFromCookie(ctx);
      return await supplierAuthDb.getSupplierDeliverySchedule(supplier.supplierId, supplier.userId);
    }),
    
    // 获取生产进度
    getProgress: publicProcedure
      .input(z.object({ planId: z.number() }))
      .query(async ({ ctx, input }) => {
        const supplier = await getSupplierFromCookie(ctx);
        return await supplierAuthDb.getSupplierProgress(supplier.supplierId, input.planId);
      }),
    
    // 更新生产进度
    updateProgress: publicProcedure
      .input(z.object({
        planId: z.number(),
        materialCode: z.string(),
        currentStep: z.enum(['material_prep', 'scheduling', 'quality_check', 'shipping', 'delivered']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supplier = await getSupplierFromCookie(ctx);
        await supplierAuthDb.updateSupplierProgress({
          supplierId: supplier.supplierId,
          planId: input.planId,
          materialCode: input.materialCode,
          currentStep: input.currentStep,
          notes: input.notes,
        });
        return { success: true };
      }),
    
    // 批量更新生产进度
    batchUpdateProgress: publicProcedure
      .input(z.object({
        planId: z.number(),
        materialCodes: z.array(z.string()),
        currentStep: z.enum(['material_prep', 'scheduling', 'quality_check', 'shipping', 'delivered']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supplier = await getSupplierFromCookie(ctx);
        await supplierAuthDb.batchUpdateSupplierProgress({
          supplierId: supplier.supplierId,
          planId: input.planId,
          materialCodes: input.materialCodes,
          currentStep: input.currentStep,
          notes: input.notes,
        });
        return { success: true };
      }),
    
    // 获取供应商确认记录
    getConfirmations: publicProcedure.query(async ({ ctx }) => {
      const supplier = await getSupplierFromCookie(ctx);
      return await supplierAuthDb.getSupplierConfirmations(supplier.supplierId);
    }),
    
    // 获取供应商消息
    getMessages: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        const supplier = await getSupplierFromCookie(ctx);
        return await supplierAuthDb.getSupplierMessages(supplier.supplierId, input?.limit || 50);
      }),
    
    // 获取未读消息数量
    getUnreadCount: publicProcedure.query(async ({ ctx }) => {
      const supplier = await getSupplierFromCookie(ctx);
      return await supplierAuthDb.getSupplierUnreadMessageCount(supplier.supplierId);
    }),
    
    // 标记消息为已读
    markMessageAsRead: publicProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const supplier = await getSupplierFromCookie(ctx);
        await supplierAuthDb.markSupplierMessageAsRead(input.messageId, supplier.supplierId);
        return { success: true };
      }),
    
    // 标记所有消息为已读
    markAllMessagesAsRead: publicProcedure.mutation(async ({ ctx }) => {
      const supplier = await getSupplierFromCookie(ctx);
      await supplierAuthDb.markAllSupplierMessagesAsRead(supplier.supplierId);
      return { success: true };
    }),
  }),
  
  // 管理员管理供应商账号
  supplierAccountAdmin: router({
    // 获取所有供应商账号
    list: protectedProcedure.query(async ({ ctx }) => {
      return await supplierAuthDb.getSupplierAccountsByUserId(ctx.user.id);
    }),
    
    // 创建供应商账号
    create: protectedProcedure
      .input(z.object({
        supplierId: z.number(),
        supplierName: z.string().optional(),
        pinCode: z.string().default('888888'),
      }))
      .mutation(async ({ ctx, input }) => {
        // 检查是否已存在账号
        const existing = await supplierAuthDb.getSupplierAccountBySupplierId(input.supplierId);
        if (existing) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '该供应商已有账号',
          });
        }
        
        // 生成供应商编号
        const supplierCode = await supplierAuthDb.generateSupplierCode(ctx.user.id);
        
        // 创建账号
        const accountId = await supplierAuthDb.createSupplierAccount({
          supplierId: input.supplierId,
          userId: ctx.user.id,
          supplierCode,
          pinCode: input.pinCode,
        });
        
        return {
          success: true,
          accountId,
          supplierCode,
          pinCode: input.pinCode,
          supplierName: input.supplierName || '',
        };
      }),
    
    // 重置 PIN码
    resetPin: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        newPin: z.string().default('888888'),
      }))
      .mutation(async ({ ctx, input }) => {
        await supplierAuthDb.resetSupplierPin(input.accountId, input.newPin);
        return { success: true, newPin: input.newPin };
      }),
    
    // 删除供应商账号
    delete: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await supplierAuthDb.deleteSupplierAccount(input.accountId, ctx.user.id);
        return { success: true };
      }),
  }),
});

// 辅助函数：从 cookie 获取供应商信息
async function getSupplierFromCookie(ctx: any): Promise<{ supplierId: number; userId: number }> {
  const cookieHeader = ctx.req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c: string) => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );
  const token = cookies[SUPPLIER_COOKIE_NAME];
  if (!token) throw new TRPCError({ code: 'UNAUTHORIZED', message: '请先登录供应商门户' });
  
  try {
    const decoded = jwt.verify(token, ENV.jwtSecret) as { supplierAccountId: number; supplierId: number; userId: number };
    return { supplierId: decoded.supplierId, userId: decoded.userId };
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' });
  }
}

export type AppRouter = typeof appRouter;
