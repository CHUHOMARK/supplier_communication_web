import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { parseMaterialPlanExcel, parseSupplierMappingExcel } from "./excelParser";
import { generateSupplierEmail, generateEmailCSV } from "./emailGenerator";
import { TRPCError } from "@trpc/server";
import { generateModificationExcel } from "./modificationExporter";

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
    
    // 更新供应商邮箱
    updateEmail: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        email: z.string().email('请输入有效的邮箱地址'),
      }))
      .mutation(async ({ input }) => {
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
              userId: ctx.user.id,
              planId: input.planId,
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
            userId: ctx.user.id,
            planId: input.planId,
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
            ctx.user.id
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
        const { sendEmail } = await import('./emailService');
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

        await db.createSupplierConfirmation({
          userId: ctx.user.id,
          planId: input.planId,
          supplierId: input.supplierId,
          emailLogId: Number(logId),
          confirmToken: token,
          expiresAt,
          status: 'pending', // 显式指定初始状态
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

        // 发送邮件（带附件）
        const result = await sendEmail({
          to: input.recipientEmail,
          subject: emailContent.subject,
          html: emailContent.body,
          attachments: emailContent.attachment ? [emailContent.attachment] : undefined,
        });

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
        const { sendEmail } = await import('./emailService');
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
                userId: ctx.user.id,
                planId: input.planId,
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
        
        const items = allItems.filter(item => 
          supplierMaterialCodes.has(item.materialCode)
        );

        return {
          confirmation,
          supplier,
          plan,
          items,
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
});

export type AppRouter = typeof appRouter;
