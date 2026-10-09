CREATE TABLE `mobileRefreshTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` varchar(48) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mobileRefreshTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mobileRefreshTokens_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `mobileRefreshTokens_user_active_idx` ON `mobileRefreshTokens` (`userId`,`revokedAt`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `mobileRefreshTokens_session_idx` ON `mobileRefreshTokens` (`sessionId`);