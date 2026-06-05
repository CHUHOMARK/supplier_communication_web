CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessDate` timestamp NOT NULL,
	`poNumber` varchar(100) NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`materialCode` varchar(100) NOT NULL,
	`materialName` varchar(255) NOT NULL,
	`materialSpec` text,
	`purchaseQuantity` int NOT NULL,
	`confirmedQuantity` int NOT NULL,
	`receivedQuantity` int NOT NULL,
	`undeliveredQuantity` int NOT NULL,
	`requiredDeliveryDate` varchar(50),
	`purchaseStaff` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_po_user_id` ON `purchase_orders` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_po_material_code` ON `purchase_orders` (`materialCode`);--> statement-breakpoint
CREATE INDEX `idx_po_supplier_name` ON `purchase_orders` (`supplierName`);--> statement-breakpoint
CREATE INDEX `idx_po_material_supplier` ON `purchase_orders` (`materialCode`,`supplierName`);