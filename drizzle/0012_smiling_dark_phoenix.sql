ALTER TABLE `material_supplier_mappings` ADD `planId` int NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_plan_id` ON `material_supplier_mappings` (`planId`);--> statement-breakpoint
CREATE INDEX `idx_plan_material` ON `material_supplier_mappings` (`planId`,`materialCode`);