CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('supplier_reply','status_change','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`relatedId` int,
	`relatedType` varchar(50),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_notification_user_id` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_notification_is_read` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `idx_notification_created_at` ON `notifications` (`createdAt`);