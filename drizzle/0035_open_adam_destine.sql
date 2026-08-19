CREATE TABLE `globalWatermarkPresetAudits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`presetId` int,
	`action` enum('created','updated','reordered') NOT NULL,
	`summary` varchar(240) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `globalWatermarkPresetAudits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `globalWatermarkPresets_active_idx` ON `globalWatermarkPresets`;--> statement-breakpoint
ALTER TABLE `globalWatermarkPresets` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `globalWatermarkPresetAudits_created_idx` ON `globalWatermarkPresetAudits` (`createdAt`);--> statement-breakpoint
CREATE INDEX `globalWatermarkPresetAudits_preset_created_idx` ON `globalWatermarkPresetAudits` (`presetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `globalWatermarkPresets_active_order_idx` ON `globalWatermarkPresets` (`isActive`,`sortOrder`);