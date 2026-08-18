CREATE TABLE `manualCreditOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`packId` varchar(40) NOT NULL,
	`credits` int NOT NULL,
	`amountIdr` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewerUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `manualCreditOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `manualCreditOrders_user_created_idx` ON `manualCreditOrders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `manualCreditOrders_status_created_idx` ON `manualCreditOrders` (`status`,`createdAt`);