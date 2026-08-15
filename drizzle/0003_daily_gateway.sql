CREATE TABLE `communityLikes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communityLikes_id` PRIMARY KEY(`id`),
	CONSTRAINT `communityLikes_post_user_unique` UNIQUE(`postId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `communityPosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transformId` int NOT NULL,
	`userId` int NOT NULL,
	`resultUrl` text NOT NULL,
	`caption` varchar(240),
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communityPosts_id` PRIMARY KEY(`id`),
	CONSTRAINT `communityPosts_transform_unique` UNIQUE(`transformId`)
);
--> statement-breakpoint
CREATE TABLE `creditLedger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credits` int NOT NULL,
	`reason` enum('purchase','usage','refund') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditLedger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creditPurchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`packId` varchar(40) NOT NULL,
	`credits` int NOT NULL,
	`stripeCheckoutSessionId` varchar(255) NOT NULL,
	`stripeEventId` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditPurchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `creditPurchases_session_unique` UNIQUE(`stripeCheckoutSessionId`),
	CONSTRAINT `creditPurchases_event_unique` UNIQUE(`stripeEventId`)
);
--> statement-breakpoint
CREATE INDEX `communityLikes_post_idx` ON `communityLikes` (`postId`);--> statement-breakpoint
CREATE INDEX `communityPosts_published_created_idx` ON `communityPosts` (`isPublished`,`createdAt`);--> statement-breakpoint
CREATE INDEX `communityPosts_user_created_idx` ON `communityPosts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `creditLedger_user_created_idx` ON `creditLedger` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `creditPurchases_user_created_idx` ON `creditPurchases` (`userId`,`createdAt`);