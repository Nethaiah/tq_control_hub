import {
  aiSuggestions,
  appSettings,
  calendarEvents,
  categories,
  clients,
  csvImports,
  csvStagedRows,
  departments,
  integrations,
  people,
  permissionRoles,
  recurringItems,
  transactions,
} from "@/data/seed"
import { filterTransactions } from "@/domain/filters"
import {
  buildDashboardMetrics,
  buildCalendarMetrics,
  buildDepartmentRollups,
  buildPeopleMetrics,
  categoryBreakdownForFilters,
  summarizeTransactions,
} from "@/domain/metrics"
import type { TransactionFilters } from "@/domain/types"

export function getWorkspaceData() {
  return {
    departments,
    categories,
    clients,
    transactions,
    people,
    recurringItems,
    calendarEvents,
    csvImports,
    csvStagedRows,
    aiSuggestions,
    appSettings,
    integrations,
    permissionRoles,
  }
}

export function getLedgerData(filters: TransactionFilters) {
  const rows = filterTransactions(transactions, filters, clients)

  return {
    filters,
    rows,
    totals: summarizeTransactions(rows),
    departments,
    categories,
    clients,
  }
}

export function getDashboardData(filters: TransactionFilters) {
  return buildDashboardMetrics({
    transactions,
    departments,
    categories,
    clients,
    people,
    filters,
  })
}

export function getDepartmentData(filters: TransactionFilters) {
  const rows = filterTransactions(transactions, filters, clients)
  const previousRows = filterTransactions(transactions, { from: "2026-05-01", to: "2026-05-31" }, clients)

  return {
    filters,
    rollups: buildDepartmentRollups(rows, previousRows, departments, people),
    departments,
    categories,
    clients,
  }
}

export function getAiQueryBreakdown(filters: TransactionFilters) {
  return categoryBreakdownForFilters(transactions, categories, clients, filters)
}

export function getPeopleData(filters: TransactionFilters = { from: "2026-06-01", to: "2026-06-30" }) {
  return {
    people,
    departments,
    transactions,
    metrics: buildPeopleMetrics({ people, departments, transactions, filters }),
  }
}

export function getCalendarData() {
  return {
    events: calendarEvents,
    recurringItems,
    metrics: buildCalendarMetrics({ events: calendarEvents, recurringItems }),
  }
}

export function getSettingsData() {
  return {
    settings: appSettings,
    integrations,
    permissionRoles,
  }
}
