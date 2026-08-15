CREATE TABLE `userNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('community_moderation') NOT NULL,
	`title` varchar(160) NOT NULL,
	`content` varchar(360) NOT NULL,
	`relatedPostId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userNotifications_user_read_created_idx` ON `userNotifications` (`userId`,`isRead`,`createdAt`);