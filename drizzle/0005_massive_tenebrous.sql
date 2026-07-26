PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_books` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`status` text DEFAULT 'added' NOT NULL,
	`format` text,
	`total_pages` integer,
	`total_minutes` integer,
	`rating` real,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_books`("id", "book_id", "status", "format", "total_pages", "total_minutes", "rating", "started_at", "finished_at", "created_at") SELECT "id", "book_id", "status", "format", "total_pages", "total_minutes", "rating", "started_at", "finished_at", "created_at" FROM `user_books`;--> statement-breakpoint
DROP TABLE `user_books`;--> statement-breakpoint
ALTER TABLE `__new_user_books` RENAME TO `user_books`;--> statement-breakpoint
PRAGMA foreign_keys=ON;