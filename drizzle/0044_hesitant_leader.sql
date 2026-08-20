CREATE TABLE `trpcNonJsonMetricBuckets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hourStartedAt` timestamp NOT NULL,
	`operationGroup` enum('auth','brand','other') NOT NULL,
	`responseKind` enum('html','text','empty','other') NOT NULL,
	`statusClass` int NOT NULL,
	`occurrences` int NOT NULL DEFAULT 0,
	`lastObservedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trpcNonJsonMetricBuckets_id` PRIMARY KEY(`id`),
	CONSTRAINT `trpcNonJsonMetricBuckets_bucket_unique` UNIQUE(`hourStartedAt`,`operationGroup`,`responseKind`,`statusClass`)
);
--> statement-breakpoint
CREATE INDEX `trpcNonJsonMetricBuckets_hour_idx` ON `trpcNonJsonMetricBuckets` (`hourStartedAt`);