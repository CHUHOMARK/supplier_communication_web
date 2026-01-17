CREATE TABLE `confirmation_modifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`confirmationId` int NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`originalSchedule` json NOT NULL,
	`modifiedSchedule` json NOT NULL,
	`modificationReason` text,
	`modifiedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `confirmation_modifications_id` PRIMARY KEY(`id`)
);
