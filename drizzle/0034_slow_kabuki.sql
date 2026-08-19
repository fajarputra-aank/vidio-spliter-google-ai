CREATE TABLE `globalWatermarkPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(60) NOT NULL,
	`text` varchar(72) NOT NULL,
	`position` enum('top-left','top-right','center','bottom-left','bottom-right') NOT NULL,
	`size` int NOT NULL,
	`font` enum('sans','serif','mono') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `globalWatermarkPresets_id` PRIMARY KEY(`id`),
	CONSTRAINT `globalWatermarkPresets_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `globalWatermarkPresets_active_idx` ON `globalWatermarkPresets` (`isActive`);