CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND con.contype = 'f'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      constraint_record.schema_name,
      constraint_record.table_name,
      constraint_record.constraint_name
    );
  END LOOP;
END $$;
--> statement-breakpoint
TRUNCATE TABLE
  public.ai_suggestions,
  public.app_settings,
  public.audit_logs,
  public.automation_runs,
  public.calendar_events,
  public.csv_mapping_rules,
  public.csv_staged_rows,
  public.csv_imports,
  public.department_budgets,
  public.integration_connections,
  public.member_department_access,
  public.organization_members,
  public.people,
  public.permission_roles,
  public.person_transactions,
  public.recurring_runs,
  public.transaction_revisions,
  public.transactions,
  public.recurring_items,
  public.clients,
  public.categories,
  public.departments,
  public.profiles,
  public.organizations
RESTART IDENTITY CASCADE;
--> statement-breakpoint
DROP FUNCTION IF EXISTS app_private.has_department_access(text, text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS app_private.is_org_owner(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS app_private.has_org_access(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS app_private.current_member_role(text);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "organization_members" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "departments" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "member_department_access" ALTER COLUMN "member_id" SET DATA TYPE uuid USING nullif("member_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "member_department_access" ALTER COLUMN "department_id" SET DATA TYPE uuid USING nullif("department_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "department_budgets" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "department_budgets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "department_budgets" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "department_budgets" ALTER COLUMN "department_id" SET DATA TYPE uuid USING nullif("department_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "parent_id" SET DATA TYPE uuid USING nullif("parent_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "department_id" SET DATA TYPE uuid USING nullif("department_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "department_id" SET DATA TYPE uuid USING nullif("department_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "category_id" SET DATA TYPE uuid USING nullif("category_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "subcategory_id" SET DATA TYPE uuid USING nullif("subcategory_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_items" ALTER COLUMN "client_id" SET DATA TYPE uuid USING nullif("client_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "department_id" SET DATA TYPE uuid USING nullif("department_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "category_id" SET DATA TYPE uuid USING nullif("category_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "subcategory_id" SET DATA TYPE uuid USING nullif("subcategory_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "client_id" SET DATA TYPE uuid USING nullif("client_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "recurrence_id" SET DATA TYPE uuid USING nullif("recurrence_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "person_transactions" ALTER COLUMN "person_id" SET DATA TYPE uuid USING nullif("person_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "person_transactions" ALTER COLUMN "transaction_id" SET DATA TYPE uuid USING nullif("transaction_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "transaction_id" SET DATA TYPE uuid USING nullif("transaction_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "calendar_events" ALTER COLUMN "recurring_item_id" SET DATA TYPE uuid USING nullif("recurring_item_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "integration_connections" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "integration_connections" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "integration_connections" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "permission_roles" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "permission_roles" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "permission_roles" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_imports" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "csv_imports" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "csv_imports" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_imports" ALTER COLUMN "duplicate_of_import_id" SET DATA TYPE uuid USING nullif("duplicate_of_import_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ALTER COLUMN "import_id" SET DATA TYPE uuid USING nullif("import_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ALTER COLUMN "suggested_department_id" SET DATA TYPE uuid USING nullif("suggested_department_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ALTER COLUMN "suggested_category_id" SET DATA TYPE uuid USING nullif("suggested_category_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ALTER COLUMN "suggested_subcategory_id" SET DATA TYPE uuid USING nullif("suggested_subcategory_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ALTER COLUMN "transaction_id" SET DATA TYPE uuid USING nullif("transaction_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_runs" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "recurring_runs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "recurring_runs" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "recurring_runs" ALTER COLUMN "recurring_item_id" SET DATA TYPE uuid USING nullif("recurring_item_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "automation_runs" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "automation_runs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "automation_runs" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "csv_mapping_rules" ALTER COLUMN "id" SET DATA TYPE uuid USING gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "csv_mapping_rules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "csv_mapping_rules" ALTER COLUMN "organization_id" SET DATA TYPE uuid USING nullif("organization_id", '')::uuid;
--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_recurring_item_id_recurring_items_id_fk" FOREIGN KEY ("recurring_item_id") REFERENCES "public"."recurring_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_duplicate_of_import_id_csv_imports_id_fk" FOREIGN KEY ("duplicate_of_import_id") REFERENCES "public"."csv_imports"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_mapping_rules" ADD CONSTRAINT "csv_mapping_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_import_id_csv_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."csv_imports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_suggested_department_id_departments_id_fk" FOREIGN KEY ("suggested_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_suggested_category_id_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "csv_staged_rows" ADD CONSTRAINT "csv_staged_rows_suggested_subcategory_id_categories_id_fk" FOREIGN KEY ("suggested_subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "department_budgets" ADD CONSTRAINT "department_budgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "department_budgets" ADD CONSTRAINT "department_budgets_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member_department_access" ADD CONSTRAINT "member_department_access_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member_department_access" ADD CONSTRAINT "member_department_access_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "permission_roles" ADD CONSTRAINT "permission_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "person_transactions" ADD CONSTRAINT "person_transactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "person_transactions" ADD CONSTRAINT "person_transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_recurring_item_id_recurring_items_id_fk" FOREIGN KEY ("recurring_item_id") REFERENCES "public"."recurring_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ADD CONSTRAINT "transaction_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transaction_revisions" ADD CONSTRAINT "transaction_revisions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_id_recurring_items_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurring_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.current_member_role(target_organization_id uuid)
RETURNS member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT om.role
  FROM organization_members om
  WHERE om.organization_id = target_organization_id
    AND om.user_id = app_private.current_user_id()
    AND om.status = 'active'
  LIMIT 1
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.has_org_access(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = target_organization_id
      AND om.user_id = app_private.current_user_id()
      AND om.status = 'active'
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.is_org_owner(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT app_private.current_member_role(target_organization_id) = 'owner'
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.has_department_access(target_organization_id uuid, target_department_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT app_private.is_org_owner(target_organization_id)
    OR EXISTS (
      SELECT 1
      FROM organization_members om
      JOIN member_department_access mda ON mda.member_id = om.id
      WHERE om.organization_id = target_organization_id
        AND om.user_id = app_private.current_user_id()
        AND om.status = 'active'
        AND mda.department_id = target_department_id
    )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.current_member_role(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.has_org_access(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.is_org_owner(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.has_department_access(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_member_role(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.has_org_access(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.is_org_owner(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.has_department_access(uuid, uuid) TO authenticated;
--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (id = app_private.current_user_id());
--> statement-breakpoint
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (id = app_private.current_user_id());
--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = app_private.current_user_id()) WITH CHECK (id = app_private.current_user_id());
--> statement-breakpoint
CREATE POLICY "organizations_select_member" ON organizations FOR SELECT TO authenticated USING (app_private.has_org_access(id));
--> statement-breakpoint
CREATE POLICY "organizations_owner_manage" ON organizations FOR ALL TO authenticated USING (app_private.is_org_owner(id)) WITH CHECK (app_private.is_org_owner(id));
--> statement-breakpoint
CREATE POLICY "organization_members_select_self_or_owner" ON organization_members FOR SELECT TO authenticated USING (user_id = app_private.current_user_id() OR app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "organization_members_owner_manage" ON organization_members FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "member_department_access_select_self_or_owner" ON member_department_access FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.id = member_department_access.member_id AND (om.user_id = app_private.current_user_id() OR app_private.is_org_owner(om.organization_id))));
--> statement-breakpoint
CREATE POLICY "member_department_access_owner_manage" ON member_department_access FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.id = member_department_access.member_id AND app_private.is_org_owner(om.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.id = member_department_access.member_id AND app_private.is_org_owner(om.organization_id)));
--> statement-breakpoint
CREATE POLICY "departments_select_scoped" ON departments FOR SELECT TO authenticated USING (app_private.has_department_access(organization_id, id));
--> statement-breakpoint
CREATE POLICY "departments_owner_manage" ON departments FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "department_budgets_select_scoped" ON department_budgets FOR SELECT TO authenticated USING (app_private.has_department_access(organization_id, department_id));
--> statement-breakpoint
CREATE POLICY "department_budgets_owner_manage" ON department_budgets FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "categories_select_member" ON categories FOR SELECT TO authenticated USING (app_private.has_org_access(organization_id));
--> statement-breakpoint
CREATE POLICY "categories_owner_manage" ON categories FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "clients_select_member" ON clients FOR SELECT TO authenticated USING (app_private.has_org_access(organization_id));
--> statement-breakpoint
CREATE POLICY "clients_owner_manage" ON clients FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "people_owner_select" ON people FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "people_owner_manage" ON people FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "recurring_items_select_scoped" ON recurring_items FOR SELECT TO authenticated USING (app_private.has_department_access(organization_id, department_id));
--> statement-breakpoint
CREATE POLICY "recurring_items_owner_manage" ON recurring_items FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "transactions_select_scoped" ON transactions FOR SELECT TO authenticated USING (app_private.has_department_access(organization_id, department_id));
--> statement-breakpoint
CREATE POLICY "transactions_owner_manage" ON transactions FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "person_transactions_owner_select" ON person_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM people p WHERE p.id = person_transactions.person_id AND app_private.is_org_owner(p.organization_id)));
--> statement-breakpoint
CREATE POLICY "person_transactions_owner_manage" ON person_transactions FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM people p WHERE p.id = person_transactions.person_id AND app_private.is_org_owner(p.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM people p WHERE p.id = person_transactions.person_id AND app_private.is_org_owner(p.organization_id)));
--> statement-breakpoint
CREATE POLICY "calendar_events_select_scoped" ON calendar_events FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id) OR EXISTS (SELECT 1 FROM transactions t WHERE t.id = calendar_events.transaction_id AND app_private.has_department_access(calendar_events.organization_id, t.department_id)) OR EXISTS (SELECT 1 FROM recurring_items r WHERE r.id = calendar_events.recurring_item_id AND app_private.has_department_access(calendar_events.organization_id, r.department_id)));
--> statement-breakpoint
CREATE POLICY "calendar_events_owner_manage" ON calendar_events FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "app_settings_owner_select" ON app_settings FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "app_settings_owner_manage" ON app_settings FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "integration_connections_owner_select" ON integration_connections FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "integration_connections_owner_manage" ON integration_connections FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "permission_roles_owner_select" ON permission_roles FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "permission_roles_owner_manage" ON permission_roles FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "csv_imports_owner_select" ON csv_imports FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "csv_imports_owner_manage" ON csv_imports FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "csv_staged_rows_owner_select" ON csv_staged_rows FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM csv_imports ci WHERE ci.id = csv_staged_rows.import_id AND app_private.is_org_owner(ci.organization_id)));
--> statement-breakpoint
CREATE POLICY "csv_staged_rows_owner_manage" ON csv_staged_rows FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM csv_imports ci WHERE ci.id = csv_staged_rows.import_id AND app_private.is_org_owner(ci.organization_id))) WITH CHECK (EXISTS (SELECT 1 FROM csv_imports ci WHERE ci.id = csv_staged_rows.import_id AND app_private.is_org_owner(ci.organization_id)));
--> statement-breakpoint
CREATE POLICY "ai_suggestions_owner_select" ON ai_suggestions FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "ai_suggestions_owner_manage" ON ai_suggestions FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "transaction_revisions_owner_select" ON transaction_revisions FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "transaction_revisions_owner_manage" ON transaction_revisions FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "audit_logs_owner_select" ON audit_logs FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "audit_logs_owner_manage" ON audit_logs FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "recurring_runs_owner_select" ON recurring_runs FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "recurring_runs_owner_manage" ON recurring_runs FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "automation_runs_owner_select" ON automation_runs FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "automation_runs_owner_manage" ON automation_runs FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "csv_mapping_rules_owner_select" ON csv_mapping_rules FOR SELECT TO authenticated USING (app_private.is_org_owner(organization_id));
--> statement-breakpoint
CREATE POLICY "csv_mapping_rules_owner_manage" ON csv_mapping_rules FOR ALL TO authenticated USING (app_private.is_org_owner(organization_id)) WITH CHECK (app_private.is_org_owner(organization_id));
