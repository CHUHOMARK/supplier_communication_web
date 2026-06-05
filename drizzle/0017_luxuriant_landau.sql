CREATE TABLE `smtp_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountName` varchar(255) NOT NULL,
	`smtpHost` varchar(255) NOT NULL,
	`smtpPort` int NOT NULL,
	`smtpSecure` boolean NOT NULL DEFAULT true,
	`smtpUser` varchar(255) NOT NULL,
	`smtpPassword` text NOT NULL,
	`fromEmail` varchar(320) NOT NULL,
	`fromName` varchar(255),
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smtp_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_smtp_user_id` ON `smtp_accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_smtp_is_default` ON `smtp_accounts` (`isDefault`);