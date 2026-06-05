CREATE TABLE `actual_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`businessDate` varchar(20) NOT NULL,
	`actualQuantity` decimal(15,4) NOT NULL,
	`supplierName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actual_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_receipt` UNIQUE(`userId`,`materialCode`,`businessDate`)
);
--> statement-breakpoint
CREATE INDEX `idx_actual_receipt_user_id` ON `actual_receipts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_actual_receipt_material_code` ON `actual_receipts` (`materialCode`);--> statement-breakpoint
CREATE INDEX `idx_actual_receipt_business_date` ON `actual_receipts` (`businessDate`);