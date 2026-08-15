CREATE TABLE `userNotificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`communityModeration` boolean NOT NULL DEFAULT true,
	`accountActivity` boolean NOT NULL DEFAULT true,
	`productUpdates` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userNotificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userNotificationPreferences_user_unique` UNIQUE(`userId`)
);
