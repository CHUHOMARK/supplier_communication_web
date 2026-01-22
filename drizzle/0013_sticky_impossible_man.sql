DROP INDEX `idx_plan_id` ON `material_supplier_mappings`;--> statement-breakpoint
DROP INDEX `idx_plan_material` ON `material_supplier_mappings`;--> statement-breakpoint
ALTER TABLE `material_supplier_mappings` DROP COLUMN `planId`;