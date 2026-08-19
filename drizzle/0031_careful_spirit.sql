CREATE TABLE `photoShareEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transformId` int NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('whatsapp','instagram','facebook','tiktok','other') NOT NULL,
	`caption` varchar(500) NOT NULL,
	`watermarkText` varchar(72),
	`outcome` enum('shared','copied','downloaded') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoShareEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `photoShareEvents_user_transform_created_idx` ON `photoShareEvents` (`userId`,`transformId`,`createdAt`);