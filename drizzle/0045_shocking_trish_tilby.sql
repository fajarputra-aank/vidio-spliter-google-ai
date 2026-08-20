CREATE TABLE `aiProviderCapacityStatus` (
	`id` int NOT NULL,
	`status` enum('unknown','available','unavailable') NOT NULL DEFAULT 'unknown',
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`retryAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiProviderCapacityStatus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collaborationProviderRetryQueues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceTransformId` int NOT NULL,
	`priority` enum('admin','standard') NOT NULL,
	`status` enum('queued','processing','completed','cancelled') NOT NULL DEFAULT 'queued',
	`nextAttemptAt` timestamp NOT NULL,
	`retryTransformId` int,
	`notifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationProviderRetryQueues_id` PRIMARY KEY(`id`),
	CONSTRAINT `collabProviderRetryQueue_source_unique` UNIQUE(`sourceTransformId`)
);
--> statement-breakpoint
CREATE INDEX `collabProviderRetryQueue_due_priority_idx` ON `collaborationProviderRetryQueues` (`status`,`nextAttemptAt`,`priority`,`createdAt`);--> statement-breakpoint
CREATE INDEX `collabProviderRetryQueue_user_created_idx` ON `collaborationProviderRetryQueues` (`userId`,`createdAt`);