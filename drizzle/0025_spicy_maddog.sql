ALTER TABLE `photoTransforms` ADD `retryOfTransformId` int;--> statement-breakpoint
CREATE INDEX `photoTransforms_user_retry_idx` ON `photoTransforms` (`userId`,`retryOfTransformId`,`createdAt`);