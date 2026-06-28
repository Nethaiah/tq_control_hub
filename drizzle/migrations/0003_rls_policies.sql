CREATE SCHEMA IF NOT EXISTS app_private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app_private TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
  )::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.current_member_role(target_organization_id text)
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
CREATE OR REPLACE FUNCTION app_private.has_org_access(target_organization_id text)
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
CREATE OR REPLACE FUNCTION app_private.is_org_owner(target_organization_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT app_private.current_member_role(target_organization_id) = 'owner'
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.has_department_access(target_organization_id text, target_department_id text)
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
REVOKE ALL ON FUNCTION app_private.current_user_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.current_member_role(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.has_org_access(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.is_org_owner(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.has_department_access(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_user_id() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_member_role(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.has_org_access(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.is_org_owner(text) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.has_department_access(text, text) TO authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
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
