CREATE TABLE `supplier_confirmations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`supplierId` int NOT NULL,
	`emailLogId` int,
	`confirmToken` varchar(64) NOT NULL,
	`status` enum('pending','confirmed','partial','rejected','modified') NOT NULL DEFAULT 'pending',
	`supplierResponse` text,
	`supplierNotes` text,
	`confirmedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_confirmations_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_confirmations_confirmToken_unique` UNIQUE(`confirmToken`)
);
