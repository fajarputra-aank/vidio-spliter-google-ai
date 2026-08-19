CREATE TABLE `photoCollaborationLayoutPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(48) NOT NULL,
	`layout` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoCollaborationLayoutPresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photoCollaborationShareLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`transformId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoCollaborationShareLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoCollaborationShareLinks_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `photoCollaborationLayoutPresets_user_updated_idx` ON `photoCollaborationLayoutPresets` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `photoCollaborationShareLinks_user_transform_created_idx` ON `photoCollaborationShareLinks` (`userId`,`transformId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `photoCollaborationShareLinks_token_expiry_idx` ON `photoCollaborationShareLinks` (`tokenHash`,`expiresAt`);