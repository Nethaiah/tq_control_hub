import "dotenv/config"

import { randomUUID } from "node:crypto"

import {
  aiSuggestions as seedAiSuggestions,
  appSettings as seedAppSettings,
  calendarEvents as seedCalendarEvents,
  categories as seedCategories,
  clients as seedClients,
  csvImports as seedCsvImports,
  csvStagedRows as seedCsvStagedRows,
  departments as seedDepartments,
  integrations as seedIntegrations,
  people as seedPeople,
  permissionRoles as seedPermissionRoles,
  recurringItems as seedRecurringItems,
  transactions as seedTransactions,
} from "../../data/seed"
import { client, db } from "./index"
import {
  aiSuggestions,
  appSettings,
  calendarEvents,
  categories,
  clients,
  csvImports,
  csvStagedRows,
  departments,
  integrationConnections,
  memberDepartmentAccess,
  organizationMembers,
  organizations,
  people,
  permissionRoles,
  personTransactions,
  profiles,
  recurringItems,
  transactions,
} from "./schema"

const ORGANIZATION_SLUG = "techquarters"
const ORGANIZATION_NAME = "Techquarters"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AuthUserRow = {
  id: string
  email: string | null
  raw_user_meta_data: unknown
}

function idMap<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, randomUUID()]))
}

function requiredId(map: Map<string, string>, key: string, label: string) {
  const value = map.get(key)

  if (!value) {
    throw new Error(`Missing seeded ${label} mapping for ${key}`)
  }

  return value
}

function optionalId(map: Map<string, string>, key: string | null | undefined, label: string) {
  return key ? requiredId(map, key, label) : null
}

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

async function getOwnerUser() {
  const configuredOwnerId = process.env.OWNER_AUTH_USER_ID?.trim()

  if (configuredOwnerId && !UUID_PATTERN.test(configuredOwnerId)) {
    throw new Error("OWNER_AUTH_USER_ID must be a Supabase Auth user UUID")
  }

  const rows = configuredOwnerId
    ? ((await client`
        select id::text, email, raw_user_meta_data
        from auth.users
        where id = ${configuredOwnerId}::uuid
        limit 1
      `) as AuthUserRow[])
    : ((await client`
        select id::text, email, raw_user_meta_data
        from auth.users
        order by created_at asc
      `) as AuthUserRow[])

  if (configuredOwnerId && rows.length === 0) {
    throw new Error(`No Supabase Auth user found for OWNER_AUTH_USER_ID=${configuredOwnerId}`)
  }

  if (!configuredOwnerId && rows.length !== 1) {
    throw new Error(
      `Expected exactly one Supabase Auth user when OWNER_AUTH_USER_ID is unset, found ${rows.length}`
    )
  }

  const owner = rows[0]
  const email = owner.email?.toLowerCase()

  if (!email) {
    throw new Error("Owner Supabase Auth user is missing an email address")
  }

  return {
    id: owner.id,
    email,
    fullName:
      process.env.OWNER_FULL_NAME?.trim() ||
      metadataString(owner.raw_user_meta_data, "full_name") ||
      metadataString(owner.raw_user_meta_data, "name") ||
      email.split("@")[0],
  }
}

async function resetPublicData() {
  await client`
    truncate table
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
    restart identity cascade
  `
}

async function seed() {
  const owner = await getOwnerUser()
  const organizationId = randomUUID()
  const ownerMemberId = randomUUID()
  const departmentIds = idMap(seedDepartments)
  const categoryIds = idMap(seedCategories)
  const clientIds = idMap(seedClients)
  const recurringItemIds = idMap(seedRecurringItems)
  const transactionIds = idMap(seedTransactions)
  const peopleIds = idMap(seedPeople)
  const calendarEventIds = idMap(seedCalendarEvents)
  const integrationIds = idMap(seedIntegrations)
  const permissionRoleIds = idMap(seedPermissionRoles)
  const csvImportIds = idMap(seedCsvImports)
  const csvStagedRowIds = idMap(seedCsvStagedRows)
  const aiSuggestionIds = idMap(seedAiSuggestions)

  await resetPublicData()

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: organizationId,
      name: ORGANIZATION_NAME,
      slug: ORGANIZATION_SLUG,
    })

    await tx.insert(profiles).values({
      id: owner.id,
      fullName: owner.fullName,
      email: owner.email,
    })

    await tx.insert(organizationMembers).values({
      id: ownerMemberId,
      organizationId,
      userId: owner.id,
      role: "owner",
      status: "active",
    })

    await tx.insert(departments).values(
      seedDepartments.map((department) => ({
        id: requiredId(departmentIds, department.id, "department"),
        organizationId,
        name: department.name,
        color: department.color,
        monthlyBudgetUsd: department.monthlyBudgetUsd,
        active: true,
      }))
    )

    await tx.insert(memberDepartmentAccess).values(
      seedDepartments.map((department) => ({
        memberId: ownerMemberId,
        departmentId: requiredId(departmentIds, department.id, "department"),
      }))
    )

    await tx.insert(categories).values(
      seedCategories.map((category) => ({
        id: requiredId(categoryIds, category.id, "category"),
        organizationId,
        name: category.name,
        kind: category.kind,
        parentId: optionalId(categoryIds, category.parentId, "category"),
        archived: category.archived,
      }))
    )

    await tx.insert(clients).values(
      seedClients.map((seedClient) => ({
        id: requiredId(clientIds, seedClient.id, "client"),
        organizationId,
        name: seedClient.name,
        status: seedClient.status,
        startDate: seedClient.startDate,
        mrrUsd: seedClient.mrrUsd,
      }))
    )

    if (seedRecurringItems.length > 0) {
      await tx.insert(recurringItems).values(
        seedRecurringItems.map((item) => ({
          id: requiredId(recurringItemIds, item.id, "recurring item"),
          organizationId,
          type: item.type,
          amount: item.amount,
          currency: item.currency,
          fxRateToUsd: item.fxRateToUsd,
          cadence: item.cadence,
          nextRun: item.nextRun,
          departmentId: requiredId(departmentIds, item.departmentId, "department"),
          categoryId: requiredId(categoryIds, item.categoryId, "category"),
          subcategoryId: optionalId(categoryIds, item.subcategoryId, "category"),
          clientId: optionalId(clientIds, item.clientId, "client"),
          vendor: item.vendor,
          template: item.template,
          idempotencyKey: item.idempotencyKey,
          active: true,
        }))
      )
    }

    await tx.insert(transactions).values(
      seedTransactions.map((transaction) => ({
        id: requiredId(transactionIds, transaction.id, "transaction"),
        organizationId,
        date: transaction.date,
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
        currency: transaction.currency,
        fxRateToUsd: transaction.fxRateToUsd,
        departmentId: requiredId(departmentIds, transaction.departmentId, "department"),
        categoryId: requiredId(categoryIds, transaction.categoryId, "category"),
        subcategoryId: optionalId(categoryIds, transaction.subcategoryId, "category"),
        clientId: optionalId(clientIds, transaction.clientId, "client"),
        vendor: transaction.vendor,
        recurring: transaction.recurring,
        recurrenceId: optionalId(recurringItemIds, transaction.recurrenceId, "recurring item"),
        source: transaction.source,
        attachmentUrl: transaction.attachmentUrl,
        createdBy: transaction.createdBy,
        status: "active",
      }))
    )

    if (seedPeople.length > 0) {
      await tx.insert(people).values(
        seedPeople.map((person) => ({
          id: requiredId(peopleIds, person.id, "person"),
          organizationId,
          departmentId: requiredId(departmentIds, person.departmentId, "department"),
          name: person.name,
          role: person.role,
          type: person.type,
          costUsd: person.costUsd,
          cadence: person.cadence,
          startDate: person.startDate,
          status: person.status,
          payrollSensitive: true,
        }))
      )
    }

    const personTransactionRows = seedPeople.flatMap((person) =>
      person.transactionIds.map((transactionId) => ({
        personId: requiredId(peopleIds, person.id, "person"),
        transactionId: requiredId(transactionIds, transactionId, "transaction"),
      }))
    )

    if (personTransactionRows.length > 0) {
      await tx.insert(personTransactions).values(personTransactionRows)
    }

    if (seedCalendarEvents.length > 0) {
      await tx.insert(calendarEvents).values(
        seedCalendarEvents.map((event) => ({
          id: requiredId(calendarEventIds, event.id, "calendar event"),
          organizationId,
          title: event.title,
          date: event.date,
          type: event.type,
          amountUsd: event.amountUsd,
          transactionId: optionalId(transactionIds, event.transactionId, "transaction"),
          recurringItemId: optionalId(recurringItemIds, event.recurringItemId, "recurring item"),
        }))
      )
    }

    await tx.insert(appSettings).values({
      id: randomUUID(),
      organizationId,
      operatingCurrency: seedAppSettings.operatingCurrency,
      reportingCurrency: seedAppSettings.reportingCurrency,
      fiscalYearStartMonth: seedAppSettings.fiscalYearStartMonth,
      timezone: seedAppSettings.timezone,
      approvalPolicy: seedAppSettings.approvalPolicy,
    })

    if (seedIntegrations.length > 0) {
      await tx.insert(integrationConnections).values(
        seedIntegrations.map((integration) => ({
          id: requiredId(integrationIds, integration.id, "integration"),
          organizationId,
          name: integration.name,
          kind: integration.kind,
          status: integration.status,
          destination: integration.destination,
          stagingRequired: integration.stagingRequired,
          commitPolicy: integration.commitPolicy,
          notes: integration.notes,
        }))
      )
    }

    if (seedPermissionRoles.length > 0) {
      await tx.insert(permissionRoles).values(
        seedPermissionRoles.map((role) => ({
          id: requiredId(permissionRoleIds, role.id, "permission role"),
          organizationId,
          name: role.name,
          scope: role.scope,
          permissions: role.permissions,
        }))
      )
    }

    if (seedCsvImports.length > 0) {
      await tx.insert(csvImports).values(
        seedCsvImports.map((csvImport) => ({
          id: requiredId(csvImportIds, csvImport.id, "CSV import"),
          organizationId,
          filename: csvImport.filename,
          fileHash: csvImport.fileHash,
          uploadedAt: new Date(csvImport.uploadedAt),
          rowCount: csvImport.rowCount,
          status: csvImport.status,
          delimiter: csvImport.delimiter,
          encoding: csvImport.encoding,
          headerRow: csvImport.headerRow,
          columnMapping: csvImport.columnMapping,
          duplicateOfImportId: optionalId(csvImportIds, csvImport.duplicateOfImportId, "CSV import"),
        }))
      )
    }

    if (seedCsvStagedRows.length > 0) {
      await tx.insert(csvStagedRows).values(
        seedCsvStagedRows.map((row) => ({
          id: requiredId(csvStagedRowIds, row.id, "CSV staged row"),
          importId: requiredId(csvImportIds, row.importId, "CSV import"),
          rawDate: row.rawDate,
          rawDescription: row.rawDescription,
          rawAmount: row.rawAmount,
          parsedDate: row.parsedDate,
          parsedAmount: row.parsedAmount,
          currency: row.currency,
          duplicate: row.duplicate,
          validationIssues: row.validationIssues,
          suggestedDepartmentId: optionalId(departmentIds, row.suggestedDepartmentId, "department"),
          suggestedCategoryId: optionalId(categoryIds, row.suggestedCategoryId, "category"),
          suggestedSubcategoryId: optionalId(categoryIds, row.suggestedSubcategoryId, "category"),
          confidence: row.confidence,
          reviewState: row.reviewState,
        }))
      )
    }

    if (seedAiSuggestions.length > 0) {
      await tx.insert(aiSuggestions).values(
        seedAiSuggestions.map((suggestion) => ({
          id: requiredId(aiSuggestionIds, suggestion.id, "AI suggestion"),
          organizationId,
          feature: suggestion.feature,
          title: suggestion.title,
          summary: suggestion.summary,
          confidence: suggestion.confidence,
          reviewState: suggestion.reviewState,
          transactionIds: suggestion.transactionIds.map((transactionId) =>
            requiredId(transactionIds, transactionId, "transaction")
          ),
          filterQuery: suggestion.filterQuery,
          proposedAction: suggestion.proposedAction,
        }))
      )
    }
  })
}

seed()
  .then(async () => {
    console.log("Clean seeded Techquarters PRD data with UUID primary keys")
    await client.end()
  })
  .catch(async (error) => {
    console.error("Failed to clean seed Techquarters PRD data", error)
    await client.end()
    process.exit(1)
  })
