CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`cover_url` text,
	`open_library_id` text,
	`isbn` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_open_library_id_unique` ON `books` (`open_library_id`);--> statement-breakpoint
CREATE TABLE `reading_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_book_id` text NOT NULL,
	`pages_read` integer,
	`minutes_read` integer,
	`note` text,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_book_id`) REFERENCES `user_books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_books` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`status` text DEFAULT 'want_to_read' NOT NULL,
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
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);