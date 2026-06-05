import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import * as db from "../db";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  resetData: adminProcedure
    .input(
      z.object({
        confirmed: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      if (!input.confirmed) {
        throw new Error('Data reset must be confirmed');
      }

      try {
        await db.resetSupplierConfirmations();
        await db.resetEmailSendLogs();
        await db.resetGeneratedEmails();

        return {
          success: true,
          message: 'Data reset successfully',
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Data reset failed',
        };
      }
    }),
});
