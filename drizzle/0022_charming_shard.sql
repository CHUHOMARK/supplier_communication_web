CREATE TABLE `supplier_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`userId` int NOT NULL,
	`supplierCode` varchar(50) NOT NULL,
	`pinCode` varchar(255) NOT NULL,
	`isFirstLogin` boolean NOT NULL DEFAULT true,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastLoginAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_accounts_supplierCode_unique` UNIQUE(`supplierCode`)
);
--> statement-breakpoint
CREATE TABLE `supplier_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('new_plan','plan_update','reminder','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`relatedPlanId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `supplier_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_production_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`planId` int NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`currentStep` enum('material_prep','scheduling','quality_check','shipping','delivered') NOT NULL DEFAULT 'material_prep',
	`materialPrepAt` timestamp,
	`schedulingAt` timestamp,
	`qualityCheckAt` timestamp,
	`shippingAt` timestamp,
	`deliveredAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_production_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_spp_progress` UNIQUE(`supplierId`,`planId`,`materialCode`)
);
--> statement-breakpoint
CREATE INDEX `idx_sa_supplier_id` ON `supplier_accounts` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_sa_user_id` ON `supplier_accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_sm_supplier_id` ON `supplier_messages` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_sm_is_read` ON `supplier_messages` (`isRead`);--> statement-breakpoint
CREATE INDEX `idx_sm_created_at` ON `supplier_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_spp_supplier_id` ON `supplier_production_progress` (`supplierId`);--> statement-breakpoint
CREATE INDEX `idx_spp_plan_id` ON `supplier_production_progress` (`planId`);--> statement-breakpoint
CREATE INDEX `idx_spp_material_code` ON `supplier_production_progress` (`materialCode`);