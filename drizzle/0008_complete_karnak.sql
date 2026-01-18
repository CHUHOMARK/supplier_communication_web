CREATE INDEX `idx_user_id` ON `material_supplier_mappings` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_material_code` ON `material_supplier_mappings` (`materialCode`);--> statement-breakpoint
CREATE INDEX `idx_user_material` ON `material_supplier_mappings` (`userId`,`materialCode`);