ALTER TABLE "csv_staged_rows" ADD COLUMN "suggestion_source" text DEFAULT 'keyword' NOT NULL;--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD COLUMN "suggestion_model" text;