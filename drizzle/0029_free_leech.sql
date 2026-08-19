CREATE TABLE `seasonalRecipeCollections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(48) NOT NULL,
	`name` varchar(80) NOT NULL,
	`season` enum('ramadan','lebaran') NOT NULL,
	`description` varchar(240) NOT NULL,
	`recipeIds` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seasonalRecipeCollections_id` PRIMARY KEY(`id`),
	CONSTRAINT `seasonalRecipeCollections_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `seasonalRecipeCollections_active_updated_idx` ON `seasonalRecipeCollections` (`isActive`,`updatedAt`);