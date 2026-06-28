CREATE TYPE "public"."ai_feature" AS ENUM('categorization', 'natural_language_query', 'anomaly', 'briefing', 'forecast', 'ocr');--> statement-breakpoint
CREATE TYPE "public"."ai_review_state" AS ENUM('draft', 'applied', 'dismissed', 'needs_human');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('payroll', 'retainer', 'invoice_due', 'renewal', 'tax', 'review');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused', 'lead');--> statement-breakpoint
CREATE TYPE "public"."csv_import_status" AS ENUM('staged', 'blocked_duplicate', 'committed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."csv_review_state" AS ENUM('approved', 'needs_human', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'AED');--> statement-breakpoint
CREATE TYPE "public"."integration_kind" AS ENUM('payments', 'bank', 'accounting', 'notification', 'mirror');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('not_connected', 'planned', 'mirror_only');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'invited', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."person_cadence" AS ENUM('monthly', 'weekly', 'hourly');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('active', 'paused', 'offboarded');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('employee', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."recurring_cadence" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('manual', 'csv', 'automation');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('revenue', 'expense');--> statement-breakpoint
CREATE TABLE "ai_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"feature" "ai_feature" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"review_state" "ai_review_state" NOT NULL,
	"transaction_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filter_query" text,
	"proposed_action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"operating_currency" "currency" NOT NULL,
	"reporting_currency" "currency" NOT NULL,
	"fiscal_year_start_month" text NOT NULL,
	"timezone" text NOT NULL,
	"approval_policy" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"source" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"type" "calendar_event_type" NOT NULL,
	"amount_usd" numeric(14, 2) NOT NULL,
	"transaction_id" text,
	"recurring_item_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"parent_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "client_status" NOT NULL,
	"start_date" date NOT NULL,
	"mrr_usd" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "csv_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"filename" text NOT NULL,
	"file_hash" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"row_count" integer NOT NULL,
	"status" "csv_import_status" NOT NULL,
	"delimiter" text NOT NULL,
	"encoding" text NOT NULL,
	"header_row" integer NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duplicate_of_import_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "csv_mapping_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_signature" text NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_mapping_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "csv_staged_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text NOT NULL,
	"raw_date" text NOT NULL,
	"raw_description" text NOT NULL,
	"raw_amount" text NOT NULL,
	"parsed_date" date,
	"parsed_amount" numeric(14, 2),
	"currency" "currency",
	"duplicate" boolean DEFAULT false NOT NULL,
	"validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_department_id" text,
	"suggested_category_id" text,
	"suggested_subcategory_id" text,
	"confidence" numeric(5, 4) NOT NULL,
	"review_state" "csv_review_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "department_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"department_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"budget_usd" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"monthly_budget_usd" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "integration_kind" NOT NULL,
	"status" "integration_status" NOT NULL,
	"destination" text NOT NULL,
	"staging_required" boolean DEFAULT true NOT NULL,
	"commit_policy" text NOT NULL,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "member_department_access" (
	"member_id" text NOT NULL,
	"department_id" text NOT NULL,
	CONSTRAINT "member_department_access_member_id_department_id_pk" PRIMARY KEY("member_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "member_department_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"department_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"type" "person_type" NOT NULL,
	"cost_usd" numeric(12, 2) NOT NULL,
	"cadence" "person_cadence" NOT NULL,
	"start_date" date NOT NULL,
	"status" "person_status" NOT NULL,
	"payroll_sensitive" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permission_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permission_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "person_transactions" (
	"person_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	CONSTRAINT "person_transactions_person_id_transaction_id_pk" PRIMARY KEY("person_id","transaction_id")
);
--> statement-breakpoint
ALTER TABLE "person_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"fx_rate_to_usd" numeric(12, 6) NOT NULL,
	"cadence" "recurring_cadence" NOT NULL,
	"next_run" date NOT NULL,
	"department_id" text NOT NULL,
	"category_id" text NOT NULL,
	"subcategory_id" text,
	"client_id" text,
	"vendor" text,
	"template" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"recurring_item_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transaction_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"revision" integer NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"date" date NOT NULL,
	"type" "transaction_type" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"fx_rate_to_usd" numeric(12, 6) NOT NULL,
	"department_id" text NOT NULL,
	"category_id" text NOT NULL,
	"subcategory_id" text,
	"client_id" text,
	"vendor" text,
	"recurring" boolean DEFAULT false NOT NULL,
	"recurrence_id" text,
	"source" "transaction_source" NOT NULL,
	"attachment_url" text,
	"created_by" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurring_item_id_recurring_items_id_fk" FOREIGN KEY ("recurring_item_id") REFERENCES "public"."recurring_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_mapping_rules" ADD CONSTRAINT "csv_mapping_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_import_id_csv_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."csv_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_suggested_department_id_departments_id_fk" FOREIGN KEY ("suggested_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_suggested_category_id_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_suggested_subcategory_id_categories_id_fk" FOREIGN KEY ("suggested_subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_budgets" ADD CONSTRAINT "department_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_budgets" ADD CONSTRAINT "department_budgets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_department_access" ADD CONSTRAINT "member_department_access_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_department_access" ADD CONSTRAINT "member_department_access_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_transactions" ADD CONSTRAINT "person_transactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_transactions" ADD CONSTRAINT "person_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_recurring_item_id_recurring_items_id_fk" FOREIGN KEY ("recurring_item_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_revisions" ADD CONSTRAINT "transaction_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_revisions" ADD CONSTRAINT "transaction_revisions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_org_date_idx" ON "calendar_events" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "categories_org_parent_idx" ON "categories" USING btree ("organization_id","parent_id");--> statement-breakpoint
CREATE INDEX "categories_org_kind_idx" ON "categories" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX "clients_org_status_idx" ON "clients" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "csv_imports_org_file_hash_idx" ON "csv_imports" USING btree ("organization_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "csv_mapping_rules_org_signature_unique" ON "csv_mapping_rules" USING btree ("organization_id","file_signature");--> statement-breakpoint
CREATE INDEX "csv_staged_rows_import_review_state_idx" ON "csv_staged_rows" USING btree ("import_id","review_state");--> statement-breakpoint
CREATE INDEX "department_budgets_org_department_idx" ON "department_budgets" USING btree ("organization_id","department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "department_budgets_department_period_unique" ON "department_budgets" USING btree ("department_id","period_start");--> statement-breakpoint
CREATE INDEX "departments_org_idx" ON "departments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_connections_org_kind_idx" ON "integration_connections" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX "member_department_access_department_idx" ON "member_department_access" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_org_idx" ON "organization_members" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "people_org_department_status_idx" ON "people" USING btree ("organization_id","department_id","status");--> statement-breakpoint
CREATE INDEX "recurring_items_org_next_run_idx" ON "recurring_items" USING btree ("organization_id","next_run");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_items_org_idempotency_key_unique" ON "recurring_items" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_runs_org_idempotency_key_unique" ON "recurring_runs" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transactions_org_date_idx" ON "transactions" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "transactions_org_type_date_idx" ON "transactions" USING btree ("organization_id","type","date");--> statement-breakpoint
CREATE INDEX "transactions_org_department_date_idx" ON "transactions" USING btree ("organization_id","department_id","date");--> statement-breakpoint
CREATE INDEX "transactions_org_category_date_idx" ON "transactions" USING btree ("organization_id","category_id","date");--> statement-breakpoint
CREATE INDEX "transactions_org_client_date_idx" ON "transactions" USING btree ("organization_id","client_id","date");--> statement-breakpoint
CREATE INDEX "transactions_org_source_date_idx" ON "transactions" USING btree ("organization_id","source","date");--> statement-breakpoint
CREATE INDEX "transactions_org_recurring_date_idx" ON "transactions" USING btree ("organization_id","recurring","date");