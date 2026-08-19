CREATE TABLE `photoCollaborationBrandLogos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(48) NOT NULL,
	`storageKey` varchar(520) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoCollaborationBrandLogos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `photoCollaborationShareLinks` ADD `watermarkLogoId` int;--> statement-breakpoint
ALTER TABLE `photoCollaborationShareLinks` ADD `accessCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `photoCollaborationShareLinks` ADD `lastAccessedAt` timestamp;--> statement-breakpoint
ALTER TABLE `photoCollaborationShareLinks` ADD `expiryNotifiedAt` timestamp;--> statement-breakpoint
CREATE INDEX `photoCollaborationBrandLogos_user_created_idx` ON `photoCollaborationBrandLogos` (`userId`,`createdAt`);