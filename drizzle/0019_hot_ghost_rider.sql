CREATE TABLE `authEmailTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`purpose` enum('email_verification','password_reset') NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authEmailTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `authEmailTokens_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `authLoginAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emailHash` varchar(64) NOT NULL,
	`failedCount` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL,
	`lockedUntil` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authLoginAttempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `authLoginAttempts_email_hash_unique` UNIQUE(`emailHash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
CREATE INDEX `authEmailTokens_user_purpose_created_idx` ON `authEmailTokens` (`userId`,`purpose`,`createdAt`);--> statement-breakpoint
CREATE INDEX `authLoginAttempts_locked_until_idx` ON `authLoginAttempts` (`lockedUntil`);