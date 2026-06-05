CREATE TABLE `generated_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`supplierId` int NOT NULL,
	`emailSubject` text NOT NULL,
	`emailBody` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`materialName` text NOT NULL,
	`materialSpec` text,
	`unitUsage` decimal(10,2),
	`demand` decimal(15,2),
	`inventory` decimal(15,2),
	`shortage` decimal(15,2),
	`inTransit` decimal(15,2),
	`total` decimal(15,2),
	`dailySchedule` json,
	CONSTRAINT `material_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`planStartDate` varchar(20) NOT NULL,
	`planEndDate` varchar(20) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_supplier_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`supplierId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_supplier_mappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`contactPerson` varchar(100),
	`email` varchar(320),
	`phone` varchar(50),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
