CREATE TABLE `userSecuritySummaryPreferences` (
	`userId` int NOT NULL,
	`frequency` enum('disabled','daily','weekly') NOT NULL DEFAULT 'disabled',
	`lastSentAt` timestamp,
	`lastSentPeriodKey` varchar(40),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSecuritySummaryPreferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE INDEX `userSecuritySummaryPreferences_frequency_idx` ON `userSecuritySummaryPreferences` (`frequency`);