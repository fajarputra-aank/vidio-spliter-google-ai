DROP INDEX `photoAlbums_user_created_idx` ON `photoAlbums`;--> statement-breakpoint
ALTER TABLE `photoAlbums` ADD `isArchived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `photoAlbums` ADD `archivedAt` timestamp;--> statement-breakpoint
CREATE INDEX `photoAlbums_user_archived_created_idx` ON `photoAlbums` (`userId`,`isArchived`,`createdAt`);