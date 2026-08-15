CREATE TABLE `photoPromptFavorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`instruction` varchar(360) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoPromptFavorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoPromptFavorites_user_instruction_unique` UNIQUE(`userId`,`instruction`)
);
--> statement-breakpoint
CREATE INDEX `photoPromptFavorites_user_created_idx` ON `photoPromptFavorites` (`userId`,`createdAt`);