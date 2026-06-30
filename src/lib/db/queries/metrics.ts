import { and, asc, eq, inArray, sql } from "drizzle-orm"

import { amountToUsd, formatCurrency, formatPercent } from "@/domain/currency"
import {
  buildLedgerHref,
  DEFAULT_MONTH_FILTERS,
  exactLedgerFilters,
  filterTransactions,
  previousPeriod,
} from "@/domain/filters"
import {
  buildCalendarMetrics as buildCalendarMetricsFromRows,
  buildDepartmentRollups,
  buildMrrTrend,
  buildPeopleMetrics as buildPeopleMetricsFromRows,
  monthlySeries,
  mrrForTransactions,
  summarizeTransactions,
} from "@/domain/metrics"
import type {
  CalendarMetrics,
  DashboardMetrics,
  DepartmentRollup,
  PeopleMetrics,
} from "@/domain/metrics"
import type {
  CalendarEvent,
  Category,
  Client,
  Department,
  KpiMetric,
  Person,
  RecurringItem,
  Transaction,
  TransactionFilters,
} from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"
import type { MetricsFilter } from "@/lib/api/filters"

import { db } from "../index"
import {
  calendarEvents,
  categories,
  clients,
  departments,
  people,
  personTransactions,
  recurringItems,
  transactions,
} from "../schema"
import {
  baseTransactionConditions,
  transactionFilterConditions,
} from "./transactions"

type DepartmentRow = typeof departments.$inferSelect
type CategoryRow = typeof categories.$inferSelect
type ClientRow = typeof clients.$inferSelect
type PersonRow = typeof people.$inferSelect
type CalendarEventRow = typeof calendarEvents.$inferSelect
type RecurringItemRow = typeof recurringItems.$inferSelect
type TransactionRow = typeof transactions.$inferSelect

function toTransaction(row: TransactionRow): Transaction {
  return {
    amount: row.amount,
    attachmentUrl: row.attachmentUrl,
    categoryId: row.categoryId,
    clientId: row.clientId,
    createdBy: row.createdBy,
    currency: row.currency,
    date: row.date,
    departmentId: row.departmentId,
    description: row.description,
    fxRateToUsd: row.fxRateToUsd,
    id: row.id,
    recurrenceId: row.recurrenceId,
    recurring: row.recurring,
    source: row.source,
    subcategoryId: row.subcategoryId,
    type: row.type,
    vendor: row.vendor,
  }
}

function toDepartment(row: DepartmentRow): Department {
  return {
    color: row.color,
    id: row.id,
    monthlyBudgetUsd: Number(row.monthlyBudgetUsd ?? 0),
    name: row.name,
  }
}

function toCategory(row: CategoryRow): Category {
  return {
    archived: row.archived,
    id: row.id,
    kind: row.kind,
    name: row.name,
    parentId: row.parentId,
  }
}

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    mrrUsd: Number(row.mrrUsd ?? 0),
    name: row.name,
    startDate: row.startDate,
    status: row.status,
  }
}

function toCalendarEvent(row: CalendarEventRow): CalendarEvent {
  return {
    amountUsd: Number(row.amountUsd ?? 0),
    date: row.date,
    id: row.id,
    recurringItemId: row.recurringItemId,
    title: row.title,
    transactionId: row.transactionId,
    type: row.type,
  }
}

function toRecurringItem(row: RecurringItemRow): RecurringItem {
  return {
    amount: Number(row.amount),
    cadence: row.cadence,
    categoryId: row.categoryId,
    clientId: row.clientId,
    currency: row.currency,
    departmentId: row.departmentId,
    fxRateToUsd: Number(row.fxRateToUsd),
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    nextRun: row.nextRun,
    subcategoryId: row.subcategoryId,
    template: row.template,
    type: row.type,
    vendor: row.vendor,
  }
}

function toPerson(row: PersonRow, transactionIds: string[]): Person {
  return {
    cadence: row.cadence,
    costUsd: Number(row.costUsd ?? 0),
    departmentId: row.departmentId,
    id: row.id,
    name: row.name,
    role: row.role,
    startDate: row.startDate,
    status: row.status,
    transactionIds,
    type: row.type,
  }
}

function normalizeFilters(filters: MetricsFilter): TransactionFilters {
  return {
    categoryId: filters.categoryId ?? undefined,
    clientOrVendor: filters.clientOrVendor ?? undefined,
    departmentId: filters.departmentId ?? undefined,
    from: filters.from ?? DEFAULT_MONTH_FILTERS.from,
    ids: filters.ids ?? undefined,
    search: filters.search ?? undefined,
    source: filters.source ?? undefined,
    to: filters.to ?? DEFAULT_MONTH_FILTERS.to,
    type: filters.type ?? undefined,
  }
}

function departmentScopeConditions(context: AuthOrganizationContext) {
  const conditions = [eq(departments.organizationId, context.organization.id)]

  if (context.membership?.role !== "owner") {
    if (context.departmentIds.length > 0) {
      conditions.push(inArray(departments.id, context.departmentIds))
    } else {
      conditions.push(sql`false`)
    }
  }

  return conditions
}

async function loadLookupTables(context: AuthOrganizationContext) {
  const orgId = context.organization.id
  const [departmentRows, categoryRows, clientRows] = await Promise.all([
    db
      .select()
      .from(departments)
      .where(and(...departmentScopeConditions(context)))
      .orderBy(asc(departments.name)),
    db
      .select()
      .from(categories)
      .where(eq(categories.organizationId, orgId))
      .orderBy(asc(categories.kind), asc(categories.name)),
    context.membership?.role === "owner"
      ? db
          .select()
          .from(clients)
          .where(eq(clients.organizationId, orgId))
          .orderBy(asc(clients.name))
      : Promise.resolve([]),
  ])

  return {
    categories: categoryRows.map(toCategory),
    clients: clientRows.map(toClient),
    departments: departmentRows.map(toDepartment),
  }
}

async function loadOrgTransactions(
  context: AuthOrganizationContext,
  filters?: MetricsFilter
): Promise<Transaction[]> {
  const conditions = [...baseTransactionConditions(context)]
  if (filters) {
    conditions.push(...transactionFilterConditions(filters))
  }

  const rows = await db
    .select({ transaction: transactions })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(and(...conditions))

  return rows.map((row) => toTransaction(row.transaction))
}

async function loadPeopleWithLinks(context: AuthOrganizationContext) {
  const orgId = context.organization.id
  const peopleConditions = [eq(people.organizationId, orgId)]

  if (context.membership?.role !== "owner") {
    if (context.departmentIds.length > 0) {
      peopleConditions.push(inArray(people.departmentId, context.departmentIds))
    } else {
      peopleConditions.push(sql`false`)
    }
  }

  const peopleRows = await db
    .select()
    .from(people)
    .where(and(...peopleConditions))
    .orderBy(asc(people.name))

  const personIds = peopleRows.map((row) => row.id)
  const linkRows = personIds.length
    ? await db
        .select({
          personId: personTransactions.personId,
          transactionId: personTransactions.transactionId,
        })
        .from(personTransactions)
        .where(inArray(personTransactions.personId, personIds))
    : []

  const linksByPerson = new Map<string, string[]>()
  for (const link of linkRows) {
    const list = linksByPerson.get(link.personId) ?? []
    list.push(link.transactionId)
    linksByPerson.set(link.personId, list)
  }

  return peopleRows.map((row) =>
    toPerson(row, linksByPerson.get(row.id) ?? [])
  )
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

function directionFromChange(change: number, inverse = false): KpiMetric["direction"] {
  if (Math.abs(change) < 0.1) {
    return "flat"
  }
  const up = change > 0
  return inverse ? (up ? "down" : "up") : up ? "up" : "down"
}

function findDepartmentByName(departments: Department[], name: string) {
  return departments.find((department) => department.name === name)
}

function findCategoryByName(categories: Category[], name: string, kind?: Category["kind"]) {
  return categories.find(
    (category) =>
      category.name === name &&
      category.parentId === null &&
      (!kind || category.kind === kind) &&
      !category.archived
  )
}

export async function getDashboardMetrics(
  context: AuthOrganizationContext,
  filters: MetricsFilter
): Promise<DashboardMetrics> {
  const normalizedFilters = normalizeFilters(filters)
  const previousFilters = previousPeriod(normalizedFilters)

  const [allTransactions, lookup, allPeople] = await Promise.all([
    loadOrgTransactions(context),
    loadLookupTables(context),
    loadPeopleWithLinks(context),
  ])

  const { departments, categories, clients } = lookup
  const currentTransactions = filterTransactions(allTransactions, normalizedFilters, clients)
  const previousTransactions = filterTransactions(allTransactions, previousFilters, clients)
  const totals = summarizeTransactions(currentTransactions)
  const previousTotals = summarizeTransactions(previousTransactions)
  const mrr = mrrForTransactions(currentTransactions)
  const previousMrr = mrrForTransactions(previousTransactions)

  const assumedCashUsd = 92000
  const burnRateUsd = Math.max(
    totals.expenseUsd - totals.revenueUsd,
    totals.expenseUsd * 0.35
  )
  const runwayMonths = burnRateUsd === 0 ? 24 : assumedCashUsd / burnRateUsd
  const previousRunway =
    previousTotals.expenseUsd === 0
      ? 24
      : assumedCashUsd /
        Math.max(
          previousTotals.expenseUsd - previousTotals.revenueUsd,
          previousTotals.expenseUsd * 0.35
        )

  const recurringRevenueRows = currentTransactions.filter(
    (transaction) => transaction.type === "revenue" && transaction.recurring
  )
  const currentExpenses = currentTransactions.filter(
    (transaction) => transaction.type === "expense"
  )
  const anomalyTransactions = currentExpenses.filter(
    (transaction) => amountToUsd(transaction) >= 3000
  )
  const anomalyFilters: TransactionFilters = { ...normalizedFilters, type: "expense" }

  const kpis: KpiMetric[] = [
    {
      label: "Net profit",
      value: formatCurrency(totals.netProfitUsd),
      numericValue: totals.netProfitUsd,
      changeLabel: `${formatPercent(percentChange(totals.netProfitUsd, previousTotals.netProfitUsd))} vs previous period`,
      direction: directionFromChange(percentChange(totals.netProfitUsd, previousTotals.netProfitUsd)),
      trace: {
        transactionIds: totals.transactionIds,
        filters: exactLedgerFilters(normalizedFilters, totals.transactionIds),
      },
    },
    {
      label: "Net margin",
      value: formatPercent(totals.marginPercent),
      numericValue: totals.marginPercent,
      changeLabel: `${formatPercent(totals.marginPercent - previousTotals.marginPercent)} point movement`,
      direction: directionFromChange(totals.marginPercent - previousTotals.marginPercent),
      trace: {
        transactionIds: totals.transactionIds,
        filters: exactLedgerFilters(normalizedFilters, totals.transactionIds),
      },
    },
    {
      label: "MRR",
      value: formatCurrency(mrr),
      numericValue: mrr,
      changeLabel: `${formatPercent(percentChange(mrr, previousMrr))} vs previous period`,
      direction: directionFromChange(percentChange(mrr, previousMrr)),
      trace: {
        transactionIds: recurringRevenueRows.map((transaction) => transaction.id),
        filters: exactLedgerFilters(
          { ...normalizedFilters, type: "revenue" },
          recurringRevenueRows.map((transaction) => transaction.id)
        ),
      },
    },
    {
      label: "Cash runway",
      value: `${runwayMonths.toFixed(1)} months`,
      numericValue: runwayMonths,
      changeLabel: `${formatPercent(percentChange(runwayMonths, previousRunway))} vs previous period`,
      direction: directionFromChange(percentChange(runwayMonths, previousRunway)),
      trace: {
        transactionIds: currentExpenses.map((transaction) => transaction.id),
        filters: exactLedgerFilters(
          { ...normalizedFilters, type: "expense" },
          currentExpenses.map((transaction) => transaction.id)
        ),
      },
    },
    {
      label: "Anomaly flags",
      value: `${anomalyTransactions.length}`,
      numericValue: anomalyTransactions.length,
      changeLabel: `${anomalyTransactions.length} rows need review`,
      direction: anomalyTransactions.length > 0 ? "down" : "flat",
      trace: {
        transactionIds: anomalyTransactions.map((transaction) => transaction.id),
        filters: exactLedgerFilters(
          anomalyFilters,
          anomalyTransactions.map((transaction) => transaction.id)
        ),
      },
    },
  ]

  const revenueParents = categories.filter(
    (category) => category.parentId === null && category.kind === "revenue" && !category.archived
  )
  const expenseParents = categories.filter(
    (category) => category.parentId === null && category.kind === "expense" && !category.archived
  )
  const currentRevenue = currentTransactions.filter(
    (transaction) => transaction.type === "revenue"
  )
  const totalClientRevenue = currentRevenue.reduce(
    (total, transaction) => total + amountToUsd(transaction),
    0
  )
  const departmentRollups = buildDepartmentRollups(
    currentTransactions,
    previousTransactions,
    departments,
    allPeople
  )

  const topClients = clients
    .map((client) => {
      const rows = currentRevenue.filter((transaction) => transaction.clientId === client.id)
      const revenue = rows.reduce((total, transaction) => total + amountToUsd(transaction), 0)
      return {
        clientId: client.id,
        client: client.name,
        concentrationPercent:
          totalClientRevenue === 0 ? 0 : (revenue / totalClientRevenue) * 100,
        revenue,
        transactionIds: rows.map((transaction) => transaction.id),
      }
    })
    .filter((client) => client.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  const marketingDepartment = findDepartmentByName(departments, "Marketing")
  const developmentDepartment = findDepartmentByName(departments, "Development")
  const newRevenueCategoryIds = new Set(
    [findCategoryByName(categories, "One off build", "revenue"), findCategoryByName(categories, "Consulting", "revenue")]
      .filter((category): category is Category => Boolean(category))
      .map((category) => category.id)
  )

  const marketingRows = marketingDepartment
    ? currentExpenses.filter((transaction) => transaction.departmentId === marketingDepartment.id)
    : []
  const marketingSpendUsd = marketingRows.reduce(
    (total, transaction) => total + amountToUsd(transaction),
    0
  )
  const newRevenueRows = currentRevenue.filter((transaction) =>
    newRevenueCategoryIds.has(transaction.categoryId)
  )
  const newRevenueUsd = newRevenueRows.reduce(
    (total, transaction) => total + amountToUsd(transaction),
    0
  )
  const assumedNewCustomers = Math.max(
    1,
    new Set(newRevenueRows.map((row) => row.clientId).filter((id): id is string => Boolean(id))).size
  )
  const cacUsd = marketingSpendUsd / assumedNewCustomers
  const activeMrrClients = clients.filter((client) => client.mrrUsd > 0)
  const averageMrrUsd =
    clients.length === 0
      ? 0
      : clients.reduce((total, client) => total + client.mrrUsd, 0) /
        Math.max(1, activeMrrClients.length)
  const ltvUsd = averageMrrUsd * Math.max(0.1, totals.marginPercent / 100) * 18
  const ltvToCac = cacUsd === 0 ? 0 : ltvUsd / cacUsd
  const paybackMonths =
    mrr === 0 || totals.marginPercent <= 0
      ? 0
      : cacUsd /
        ((mrr / Math.max(1, activeMrrClients.length)) * (totals.marginPercent / 100))

  const anomalies = [
    marketingDepartment
      ? {
          id: "anom_marketing",
          label: "Marketing spend should be tested against CAC",
          severity: "watch" as const,
          transactionIds: marketingRows.map((transaction) => transaction.id),
          href: buildLedgerHref({
            ...normalizedFilters,
            departmentId: marketingDepartment.id,
            type: "expense",
          }),
        }
      : null,
    developmentDepartment
      ? {
          id: "anom_dev_cost",
          label: "Development cost base is the heaviest expense line",
          severity: "risk" as const,
          transactionIds: currentExpenses
            .filter((transaction) => transaction.departmentId === developmentDepartment.id)
            .map((transaction) => transaction.id),
          href: buildLedgerHref({
            ...normalizedFilters,
            departmentId: developmentDepartment.id,
            type: "expense",
          }),
        }
      : null,
    {
      id: "anom_concentration",
      label: "Top client concentration is visible in current revenue",
      severity: "watch" as const,
      transactionIds: topClients[0]?.transactionIds ?? [],
      href: buildLedgerHref({
        ...normalizedFilters,
        clientOrVendor: topClients[0]?.clientId,
      }),
    },
  ].filter((anomaly): anomaly is NonNullable<typeof anomaly> => anomaly !== null && anomaly.transactionIds.length > 0)

  const devRollup = developmentDepartment
    ? departmentRollups.find((rollup) => rollup.department.id === developmentDepartment.id)
    : undefined
  const weeklyActions = [
    developmentDepartment
      ? {
          title: "Review development cost base",
          detail: `${formatCurrency(devRollup?.expenseUsd ?? 0)} in current development expenses`,
          href: buildLedgerHref({
            ...normalizedFilters,
            departmentId: developmentDepartment.id,
            type: "expense",
          }),
        }
      : null,
    marketingDepartment
      ? {
          title: "Test marketing spend against CAC",
          detail: `${formatCurrency(marketingSpendUsd)} marketing spend to validate`,
          href: buildLedgerHref({
            ...normalizedFilters,
            departmentId: marketingDepartment.id,
            type: "expense",
          }),
        }
      : null,
    {
      title: "Confirm low-confidence import rows",
      detail: "Review staged rows before anything touches the ledger",
      href: "/imports",
    },
  ].filter((action): action is NonNullable<typeof action> => action !== null)

  return {
    anomalies,
    budgetVsActual: departmentRollups.map((rollup) => ({
      actual: rollup.expenseUsd,
      budget: rollup.monthlyBudgetUsd,
      department: rollup.department.name,
      departmentId: rollup.department.id,
      transactionIds: rollup.transactionIds,
    })),
    cashRunway: {
      assumedCashUsd,
      burnRateUsd,
      filters: exactLedgerFilters(
        { ...normalizedFilters, type: "expense" },
        currentExpenses.map((transaction) => transaction.id)
      ),
      previousRunwayMonths: previousRunway,
      runwayMonths,
      transactionIds: currentExpenses.map((transaction) => transaction.id),
    },
    departmentRollups,
    expenseByCategory: expenseParents
      .map((category) => {
        const rows = currentExpenses.filter((transaction) => transaction.categoryId === category.id)
        return {
          category: category.name,
          categoryId: category.id,
          expense: rows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
          transactionIds: rows.map((transaction) => transaction.id),
        }
      })
      .filter((row) => row.expense > 0),
    filters: normalizedFilters,
    growthEfficiency: {
      assumptions: [
        "CAC uses current-period marketing spend divided by new one-off/consulting clients.",
        "LTV uses average active MRR, current net margin, and an 18-month expected relationship.",
        "Payback uses MRR gross margin and is labelled directional until CRM attribution is connected.",
      ],
      cacUsd,
      filters: exactLedgerFilters(
        marketingDepartment
          ? { ...normalizedFilters, type: "expense", departmentId: marketingDepartment.id }
          : { ...normalizedFilters, type: "expense" },
        marketingRows.map((transaction) => transaction.id)
      ),
      ltvToCac,
      ltvUsd,
      marketingSpendUsd,
      newRevenueUsd,
      paybackMonths,
      transactionIds: marketingRows.map((transaction) => transaction.id),
    },
    kpis,
    monthlySeries: monthlySeries(allTransactions),
    mrrTrend: buildMrrTrend(allTransactions),
    previousTotals,
    revenueByDepartment: departments
      .map((department) => {
        const rows = currentRevenue.filter(
          (transaction) => transaction.departmentId === department.id
        )
        return {
          department: department.name,
          departmentId: department.id,
          revenue: rows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
          transactionIds: rows.map((transaction) => transaction.id),
        }
      })
      .filter((row) => row.revenue > 0),
    revenueTypeSplit: revenueParents
      .map((category) => {
        const rows = currentRevenue.filter((transaction) => transaction.categoryId === category.id)
        return {
          category: category.name,
          categoryId: category.id,
          revenue: rows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
          transactionIds: rows.map((transaction) => transaction.id),
        }
      })
      .filter((row) => row.revenue > 0),
    topClients,
    totals,
    weeklyActions,
  }
}

export type DepartmentRollupsTableOptions = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?:
    | "department"
    | "revenueUsd"
    | "expenseUsd"
    | "contributionMarginUsd"
    | "marginPercent"
    | "budgetUsedPercent"
  sortDir?: "asc" | "desc"
}

export type DepartmentRollupsResponse = {
  rollups: DepartmentRollup[]
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
}

function departmentRollupSortValue(
  rollup: DepartmentRollup,
  sortBy: NonNullable<DepartmentRollupsTableOptions["sortBy"]>
) {
  if (sortBy === "department") return rollup.department.name
  return rollup[sortBy]
}

function applyDepartmentRollupTableOptions(
  rollups: DepartmentRollup[],
  options: DepartmentRollupsTableOptions = {}
): DepartmentRollupsResponse {
  const search = options.search?.trim().toLowerCase()
  const sortBy = options.sortBy ?? "department"
  const sortDir = options.sortDir ?? "asc"
  const filtered = search
    ? rollups.filter((rollup) => rollup.department.name.toLowerCase().includes(search))
    : rollups

  const sorted = [...filtered].sort((a, b) => {
    const left = departmentRollupSortValue(a, sortBy)
    const right = departmentRollupSortValue(b, sortBy)
    const result = typeof left === "string"
      ? left.localeCompare(String(right))
      : Number(left) - Number(right)

    return sortDir === "asc" ? result : -result
  })
  const totalRows = sorted.length

  if (!options.pageSize) {
    return {
      pagination: {
        page: 1,
        pageSize: totalRows,
        totalPages: totalRows > 0 ? 1 : 0,
        totalRows,
      },
      rollups: sorted,
    }
  }

  const pageSize = options.pageSize
  const totalPages = Math.ceil(totalRows / pageSize)
  const page = totalPages === 0 ? 1 : Math.min(options.page ?? 1, totalPages)
  const offset = (page - 1) * pageSize

  return {
    pagination: {
      page,
      pageSize,
      totalPages,
      totalRows,
    },
    rollups: sorted.slice(offset, offset + pageSize),
  }
}

export async function getDepartmentRollups(
  context: AuthOrganizationContext,
  filters: MetricsFilter,
  tableOptions?: DepartmentRollupsTableOptions
): Promise<DepartmentRollupsResponse> {
  const normalizedFilters = normalizeFilters(filters)
  const previousFilters = previousPeriod(normalizedFilters)

  const [allTransactions, lookup, allPeople] = await Promise.all([
    loadOrgTransactions(context),
    loadLookupTables(context),
    loadPeopleWithLinks(context),
  ])

  const { departments } = lookup
  const currentTransactions = filterTransactions(allTransactions, normalizedFilters, lookup.clients)
  const previousTransactions = filterTransactions(allTransactions, previousFilters, lookup.clients)

  const rollups = buildDepartmentRollups(currentTransactions, previousTransactions, departments, allPeople)

  return applyDepartmentRollupTableOptions(rollups, tableOptions)
}

export type PeopleMetricsResponse = {
  people: Person[]
  departments: Department[]
  pagination: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
  transactions: Transaction[]
  metrics: PeopleMetrics
}

export type PeopleTableOptions = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: "name" | "department" | "role" | "type" | "costUsd" | "startDate" | "status"
  sortDir?: "asc" | "desc"
}

function personDepartmentName(departments: Department[], departmentId: string) {
  return departments.find((department) => department.id === departmentId)?.name ?? "Unmapped"
}

function peopleSortValue(
  person: Person,
  departments: Department[],
  sortBy: NonNullable<PeopleTableOptions["sortBy"]>
) {
  if (sortBy === "department") return personDepartmentName(departments, person.departmentId)
  return person[sortBy]
}

function applyPeopleTableOptions(
  peopleRows: Person[],
  departments: Department[],
  options: PeopleTableOptions = {}
) {
  const search = options.search?.trim().toLowerCase()
  const sortBy = options.sortBy ?? "name"
  const sortDir = options.sortDir ?? "asc"
  const filtered = search
    ? peopleRows.filter((person) =>
        [
          person.name,
          personDepartmentName(departments, person.departmentId),
          person.role,
          person.type,
          person.status,
          person.startDate,
          String(person.costUsd),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      )
    : peopleRows

  const sorted = [...filtered].sort((a, b) => {
    const left = peopleSortValue(a, departments, sortBy)
    const right = peopleSortValue(b, departments, sortBy)
    const result = typeof left === "number"
      ? left - Number(right)
      : String(left).localeCompare(String(right))

    return sortDir === "asc" ? result : -result
  })
  const totalRows = sorted.length

  if (!options.pageSize) {
    return {
      pagination: {
        page: 1,
        pageSize: totalRows,
        totalPages: totalRows > 0 ? 1 : 0,
        totalRows,
      },
      people: sorted,
    }
  }

  const pageSize = options.pageSize
  const totalPages = Math.ceil(totalRows / pageSize)
  const page = totalPages === 0 ? 1 : Math.min(options.page ?? 1, totalPages)
  const offset = (page - 1) * pageSize

  return {
    pagination: {
      page,
      pageSize,
      totalPages,
      totalRows,
    },
    people: sorted.slice(offset, offset + pageSize),
  }
}

export async function getPeopleMetrics(
  context: AuthOrganizationContext,
  filters?: MetricsFilter,
  tableOptions?: PeopleTableOptions
): Promise<PeopleMetricsResponse> {
  const normalizedFilters = filters ? normalizeFilters(filters) : DEFAULT_MONTH_FILTERS
  const isOwner = context.membership?.role === "owner"

  const [allPeople, lookup, allOrgTransactions] = await Promise.all([
    loadPeopleWithLinks(context),
    loadLookupTables(context),
    loadOrgTransactions(context),
  ])

  const { departments } = lookup

  const visiblePeople = isOwner
    ? allPeople
    : allPeople.map((person) =>
        person.transactionIds.length === 0
          ? person
          : { ...person, costUsd: 0 }
      )

  const metrics = buildPeopleMetricsFromRows({
    departments,
    filters: normalizedFilters,
    people: allPeople,
    transactions: allOrgTransactions,
  })
  const peopleTable = applyPeopleTableOptions(visiblePeople, departments, tableOptions)

  return {
    departments,
    metrics,
    pagination: peopleTable.pagination,
    people: peopleTable.people,
    transactions: allOrgTransactions,
  }
}

export async function getCalendarMetrics(
  context: AuthOrganizationContext,
  startDate = "2026-07-01",
  endDate = "2026-07-30"
): Promise<CalendarMetrics> {
  const orgId = context.organization.id

  const [eventRows, recurringRows] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.organizationId, orgId))
      .orderBy(asc(calendarEvents.date)),
    db
      .select()
      .from(recurringItems)
      .where(
        and(
          eq(recurringItems.organizationId, orgId),
          eq(recurringItems.active, true)
        )
      )
      .orderBy(asc(recurringItems.nextRun)),
  ])

  const events = eventRows.map(toCalendarEvent)
  const recurringItemsDomain = recurringRows.map(toRecurringItem)

  return buildCalendarMetricsFromRows({
    endDate,
    events,
    recurringItems: recurringItemsDomain,
    startDate,
  })
}
