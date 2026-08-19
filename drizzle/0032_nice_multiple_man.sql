CREATE TABLE `photoCaptionTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`caption` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoCaptionTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoCaptionTemplates_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `photoCaptionTemplates_user_created_idx` ON `photoCaptionTemplates` (`userId`,`createdAt`);