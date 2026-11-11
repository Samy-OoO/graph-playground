PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_graphs` (
	`id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`schema_version` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`share_slug` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_graphs`("id", "owner_id", "name", "data", "schema_version", "revision", "is_public", "share_slug", "created_at", "updated_at") SELECT "id", "owner_id", "name", "data", "schema_version", "revision", "is_public", "share_slug", "created_at", "updated_at" FROM `graphs`;--> statement-breakpoint
DROP TABLE `graphs`;--> statement-breakpoint
ALTER TABLE `__new_graphs` RENAME TO `graphs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `graphs_share_slug_unique` ON `graphs` (`share_slug`);