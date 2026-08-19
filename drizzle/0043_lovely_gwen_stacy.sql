CREATE TABLE `collaborationBrandBackgroundPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(60) NOT NULL,
	`background` enum('studio-ivory','soft-gray','charcoal','cafe','garden','office') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationBrandBackgroundPresets_id` PRIMARY KEY(`id`),
	CONSTRAINT `collaborationBrandBackgroundPresets_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `photoCollaborationResultReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transformId` int NOT NULL,
	`reporterUserId` int NOT NULL,
	`reason` enum('face_mismatch','subject_changed','background_issue','other') NOT NULL,
	`details` varchar(320),
	`status` enum('open','reviewed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `photoCollaborationResultReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoCollaborationResultReports_transform_reporter_unique` UNIQUE(`transformId`,`reporterUserId`)
);
--> statement-breakpoint
CREATE INDEX `collaborationBrandBackgroundPresets_active_idx` ON `collaborationBrandBackgroundPresets` (`isActive`);--> statement-breakpoint
CREATE INDEX `photoCollaborationResultReports_status_created_idx` ON `photoCollaborationResultReports` (`status`,`createdAt`);