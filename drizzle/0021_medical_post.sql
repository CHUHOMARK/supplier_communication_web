CREATE TABLE `follow_up_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`confirmationId` int NOT NULL,
	`followUpType` enum('t_minus_3','t_minus_1','manual') NOT NULL,
	`emailSubject` varchar(500) NOT NULL,
	`emailBody` text NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follow_up_emails_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_follow_up` UNIQUE(`confirmationId`,`followUpType`)
);
--> statement-breakpoint
ALTER TABLE `supplier_confirmations` ADD `productionStatus` enum('not_started','material_prep','in_production','in_qc','ready_to_ship','shipped') DEFAULT 'not_started';--> statement-breakpoint
CREATE INDEX `idx_follow_up_user_id` ON `follow_up_emails` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_follow_up_confirmation_id` ON `follow_up_emails` (`confirmationId`);--> statement-breakpoint
CREATE INDEX `idx_follow_up_type` ON `follow_up_emails` (`followUpType`);--> statement-breakpoint
CREATE INDEX `idx_follow_up_status` ON `follow_up_emails` (`status`);