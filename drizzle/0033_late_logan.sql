CREATE TABLE `photoWatermarkPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`text` varchar(72) NOT NULL,
	`position` enum('top-left','top-right','center','bottom-left','bottom-right') NOT NULL,
	`size` int NOT NULL,
	`font` enum('sans','serif','mono') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoWatermarkPresets_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoWatermarkPresets_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `photoWatermarkPresets_user_created_idx` ON `photoWatermarkPresets` (`userId`,`createdAt`);