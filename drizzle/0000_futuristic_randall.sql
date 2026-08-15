CREATE TABLE `photoTransforms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipe` varchar(40) NOT NULL,
	`title` varchar(120) NOT NULL,
	`sourceKey` varchar(512) NOT NULL,
	`sourceUrl` text NOT NULL,
	`resultUrl` text,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`errorMessage` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `photoTransforms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `photoTransforms_user_created_idx` ON `photoTransforms` (`userId`,`createdAt`);