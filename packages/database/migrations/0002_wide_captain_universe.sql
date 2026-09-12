CREATE TABLE `gmail_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`message_id` text NOT NULL,
	`suggestion` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gmail_sync` (
	`account` text PRIMARY KEY NOT NULL,
	`history_id` text,
	`next_history_id` text,
	`pending_ids` text NOT NULL,
	`page_token` text,
	`last_checked_at` text
);
