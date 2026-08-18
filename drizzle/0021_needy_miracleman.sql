CREATE TABLE `userSessionVersions` (
	`userId` int NOT NULL,
	`version` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSessionVersions_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `userSecurityEvents` MODIFY COLUMN `kind` enum('login','password_changed','password_reset','account_locked','all_sessions_signed_out') NOT NULL;