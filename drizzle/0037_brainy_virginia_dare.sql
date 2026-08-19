CREATE TABLE `photoCollaborationInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviterUserId` int NOT NULL,
	`inviteeUserId` int NOT NULL,
	`template` varchar(32) NOT NULL,
	`aspectRatio` varchar(8) NOT NULL,
	`style` varchar(24) NOT NULL,
	`note` varchar(360),
	`status` enum('pending','accepted','declined','used','cancelled') NOT NULL DEFAULT 'pending',
	`transformId` int,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	CONSTRAINT `photoCollaborationInvites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `collaborationTemplate` varchar(32);--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `collaborationInviteId` int;--> statement-breakpoint
CREATE INDEX `photoCollaborationInvites_invitee_status_created_idx` ON `photoCollaborationInvites` (`inviteeUserId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `photoCollaborationInvites_inviter_created_idx` ON `photoCollaborationInvites` (`inviterUserId`,`createdAt`);