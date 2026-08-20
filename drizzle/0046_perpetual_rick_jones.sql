ALTER TABLE `photoTransforms` ADD `trashedAt` timestamp;--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `trashExpiresAt` timestamp;--> statement-breakpoint
CREATE INDEX `photoTransforms_user_trash_expiry_idx` ON `photoTransforms` (`userId`,`trashedAt`,`trashExpiresAt`);