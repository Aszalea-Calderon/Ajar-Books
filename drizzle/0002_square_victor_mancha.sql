CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_type_name_unique` ON `tags` (`type`,`name`);--> statement-breakpoint
CREATE TABLE `user_book_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_book_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`user_book_id`) REFERENCES `user_books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_book_tags_user_book_id_tag_id_unique` ON `user_book_tags` (`user_book_id`,`tag_id`);