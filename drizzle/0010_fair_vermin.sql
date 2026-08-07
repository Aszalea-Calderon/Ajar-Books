CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`metric` text NOT NULL,
	`target` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`created_at` integer NOT NULL
);
