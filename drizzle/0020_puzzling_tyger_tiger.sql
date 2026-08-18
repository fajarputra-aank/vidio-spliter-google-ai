CREATE TABLE `userSecurityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('login','password_changed','password_reset') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userSecurityEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userSecurityEvents_user_created_idx` ON `userSecurityEvents` (`userId`,`createdAt`);