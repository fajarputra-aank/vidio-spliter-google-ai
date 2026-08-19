CREATE TABLE `photoRecipeFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipeId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoRecipeFavorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoRecipeFavorites_user_recipe_unique` UNIQUE(`userId`,`recipeId`)
);
--> statement-breakpoint
CREATE INDEX `photoRecipeFavorites_user_created_idx` ON `photoRecipeFavorites` (`userId`,`createdAt`);