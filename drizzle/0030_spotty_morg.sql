ALTER TABLE `seasonalRecipeCollections` ADD `startsAt` timestamp;--> statement-breakpoint
ALTER TABLE `seasonalRecipeCollections` ADD `endsAt` timestamp;--> statement-breakpoint
CREATE INDEX `seasonalRecipeCollections_active_schedule_idx` ON `seasonalRecipeCollections` (`isActive`,`startsAt`,`endsAt`);