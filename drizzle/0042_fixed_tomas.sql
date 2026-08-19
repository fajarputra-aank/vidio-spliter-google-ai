CREATE TABLE `collaborationShareRoleLimits` (
	`role` enum('user','admin') NOT NULL,
	`maxActiveLinks` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collaborationShareRoleLimits_role` PRIMARY KEY(`role`)
);
--> statement-breakpoint
INSERT INTO `collaborationShareRoleLimits` (`role`, `maxActiveLinks`) VALUES ('user', 3), ('admin', NULL);
