CREATE TABLE `communityReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`reporterUserId` int NOT NULL,
	`reason` enum('inappropriate','spam','copyright','other') NOT NULL,
	`details` varchar(320),
	`status` enum('open','dismissed','actioned') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `communityReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `communityReports_post_reporter_unique` UNIQUE(`postId`,`reporterUserId`)
);
--> statement-breakpoint
CREATE TABLE `photoAlbumItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`albumId` int NOT NULL,
	`transformId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photoAlbumItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoAlbumItems_album_transform_unique` UNIQUE(`albumId`,`transformId`)
);
--> statement-breakpoint
CREATE TABLE `photoAlbums` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `photoAlbums_id` PRIMARY KEY(`id`),
	CONSTRAINT `photoAlbums_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE INDEX `communityReports_status_created_idx` ON `communityReports` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `photoAlbumItems_album_idx` ON `photoAlbumItems` (`albumId`);--> statement-breakpoint
CREATE INDEX `photoAlbums_user_created_idx` ON `photoAlbums` (`userId`,`createdAt`);