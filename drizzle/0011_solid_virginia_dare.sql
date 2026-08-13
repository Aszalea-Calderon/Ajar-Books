CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`rows` text NOT NULL,
	`total` integer NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`results` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
