CREATE TABLE `custom_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`theme` text NOT NULL,
	`accent_color` text,
	`background_texture` text NOT NULL,
	`font` text NOT NULL,
	`card_radius_scale` real NOT NULL,
	`card_opacity` real NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_themes_name_unique` ON `custom_themes` (`name`);