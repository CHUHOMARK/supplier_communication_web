ALTER TABLE `generated_emails` MODIFY COLUMN `emailSubject` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `materialName` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `unitUsage` text;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `demand` text;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `inventory` text;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `shortage` text;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `inTransit` text;--> statement-breakpoint
ALTER TABLE `material_items` MODIFY COLUMN `total` text;--> statement-breakpoint
ALTER TABLE `material_supplier_mappings` ADD `sharePercentage` decimal(5,2) DEFAULT '100.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `material_supplier_mappings` ADD `priority` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `material_supplier_mappings` ADD `notes` text;