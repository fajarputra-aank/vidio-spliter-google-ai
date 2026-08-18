CREATE TABLE `userActiveSessions` (
	`id` varchar(48) NOT NULL,
	`userId` int NOT NULL,
	`sessionVersion` int NOT NULL,
	`deviceLabel` varchar(160) NOT NULL,
	`locationLabel` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `userActiveSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userActiveSessions_user_active_idx` ON `userActiveSessions` (`userId`,`revokedAt`,`lastSeenAt`);