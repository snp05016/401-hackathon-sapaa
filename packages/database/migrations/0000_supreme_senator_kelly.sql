CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`occurred_at` text NOT NULL,
	`metadata` text,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`job_url` text NOT NULL,
	`job_description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'found' NOT NULL,
	`date_found` text NOT NULL,
	`date_applied` text,
	`last_activity_at` text NOT NULL,
	`next_action` text,
	`next_action_date` text,
	`resume_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
