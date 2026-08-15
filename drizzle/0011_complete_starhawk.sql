CREATE TABLE `scheduledJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduledJobs_name_unique` UNIQUE(`name`),
	CONSTRAINT `scheduledJobs_task_uid_unique` UNIQUE(`taskUid`)
);
--> statement-breakpoint
ALTER TABLE `userNotifications` MODIFY COLUMN `kind` enum('community_moderation','account_activity','album_inactivity') NOT NULL;--> statement-breakpoint
ALTER TABLE `photoAlbums` ADD `lastAccessedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `photoAlbums` ADD `lastInactivityReminderAt` timestamp;--> statement-breakpoint
ALTER TABLE `userNotifications` ADD `relatedAlbumId` int;