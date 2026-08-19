ALTER TABLE `photoTransforms` MODIFY COLUMN `status` enum('processing','completed','failed','cancelled') NOT NULL DEFAULT 'processing';--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `requestId` varchar(64);--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `retryInstruction` varchar(360);--> statement-breakpoint
CREATE INDEX `photoTransforms_user_request_idx` ON `photoTransforms` (`userId`,`requestId`);