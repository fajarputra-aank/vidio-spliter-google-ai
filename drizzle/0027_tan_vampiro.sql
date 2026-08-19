ALTER TABLE `photoTransforms` ADD `queuePosition` int;--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `providerAttemptCount` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `photoTransforms` ADD `autoRetryAt` timestamp;