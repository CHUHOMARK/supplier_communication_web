CREATE TABLE `share_change_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`supplierId` int NOT NULL,
	`oldSharePercentage` decimal(5,2),
	`newSharePercentage` decimal(5,2) NOT NULL,
	`changeReason` text,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_change_history_id` PRIMARY KEY(`id`)
);
