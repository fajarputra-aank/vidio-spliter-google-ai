CREATE TABLE `adminAccessAudits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`action` enum('role_changed','unlimited_access_changed') NOT NULL,
	`previousRole` enum('user','admin') NOT NULL,
	`nextRole` enum('user','admin') NOT NULL,
	`previousUnlimitedTransforms` boolean NOT NULL,
	`nextUnlimitedTransforms` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAccessAudits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brandSettings` (
	`id` int NOT NULL,
	`logoUrl` text NOT NULL,
	`iconUrl` text NOT NULL,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brandSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `adminAccessAudits_created_idx` ON `adminAccessAudits` (`createdAt`);--> statement-breakpoint
CREATE INDEX `adminAccessAudits_target_created_idx` ON `adminAccessAudits` (`targetUserId`,`createdAt`);