import { amountToUsd, formatCurrency, formatPercent } from "@/domain/currency"
import {
  buildLedgerHref,
  DEFAULT_MONTH_FILTERS,
  exactLedgerFilters,
  filterTransactions,
  previousPeriod,
} from "@/domain/filters"
import type {
  Category,
  CalendarEvent,
  Client,
  Department,
  KpiMetric,
  Person,
  RecurringItem,
  Transaction,
  TransactionFilters,
} from "@/domain/types"
import { formatMonthLabel } from "@/lib/format"

export type LedgerTotals = {
  revenueUsd: number
  expenseUsd: number
  netProfitUsd: number
  marginPercent: number
  rowCount: number
  transactionIds: string[]
}

export type MonthlySeriesPoint = {
  month: string
  label: string
  revenue: number
  expenses: number
  netProfit: number
  marginPercent: number
}

export type DepartmentRollup = {
  department: Department
  revenueUsd: number
  expenseUsd: number
  contributionMarginUsd: number
  marginPercent: number
  headcount: number
  monthlyBudgetUsd: number
  budgetUsedPercent: number
  trend: "up" | "down" | "flat"
  transactionIds: string[]
}

export type DashboardMetrics = {
  filters: TransactionFilters
  totals: LedgerTotals
  previousTotals: LedgerTotals
  kpis: KpiMetric[]
  monthlySeries: MonthlySeriesPoint[]
  mrrTrend: Array<{
    month: string
    label: string
    newMrr: number
    expansionMrr: number
    churnMrr: number
    endingMrr: number
  }>
  revenueByDepartment: Array<{
    departmentId: string
    department: string
    revenue: number
    transactionIds: string[]
  }>
  expenseByCategory: Array<{
    categoryId: string
    category: string
    expense: number
    transactionIds: string[]
  }>
  revenueTypeSplit: Array<{
    categoryId: string
    category: string
    revenue: number
    transactionIds: string[]
  }>
  topClients: Array<{
    clientId: string
    client: string
    revenue: number
    concentrationPercent: number
    transactionIds: string[]
  }>
  departmentRollups: DepartmentRollup[]
  budgetVsActual: Array<{
    departmentId: string
    department: string
    budget: number
    actual: number
    transactionIds: string[]
  }>
  cashRunway: {
    assumedCashUsd: number
    burnRateUsd: number
    runwayMonths: number
    previousRunwayMonths: number
    transactionIds: string[]
    filters: TransactionFilters
  }
  growthEfficiency: {
    marketingSpendUsd: number
    newRevenueUsd: number
    cacUsd: number
    ltvUsd: number
    ltvToCac: number
    paybackMonths: number
    assumptions: string[]
    transactionIds: string[]
    filters: TransactionFilters
  }
  anomalies: Array<{
    id: string
    label: string
    severity: "watch" | "risk"
    transactionIds: string[]
    href: string
  }>
  weeklyActions: Array<{
    title: string
    detail: string
    href: string
  }>
}

export type PeopleDepartmentCost = {
  departmentId: string
  department: string
  headcount: number
  employeeCount: number
  contractorCount: number
  peopleCostUsd: number
  linkedLedgerCostUsd: number
  revenueUsd: number
  revenuePerHeadUsd: number
  payrollAsRevenuePercent: number
  transactionIds: string[]
}

export type PeopleMetrics = {
  activeHeadcount: number
  employeeCount: number
  contractorCount: number
  peopleCostUsd: number
  linkedLedgerCostUsd: number
  revenueUsd: number
  payrollAsRevenuePercent: number
  revenuePerHeadUsd: number
  unlinkedPeopleCount: number
  departmentCosts: PeopleDepartmentCost[]
}

export type CalendarMetrics = {
  startDate: string
  endDate: string
  events: CalendarEvent[]
  expectedInflowUsd: number
  scheduledOutflowUsd: number
  cashNeededUsd: number
  netScheduledCashUsd: number
  eventsByType: Array<{
    type: CalendarEvent["type"]
    count: number
    amountUsd: number
  }>
  recurringGenerationPreview: Array<{
    id: string
    template: string
    nextRun: string
    amountUsd: number
    type: RecurringItem["type"]
    idempotencyKey: string
    calendarEventId: string | null
  }>
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

function parentCategories(categories: Category[], kind?: Category["kind"]) {
  return categories.filter(
    (category) => category.parentId === null && (!kind || category.kind === kind)
  )
}

function categoryName(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId)?.name ?? "Unmapped"
}

function monthKey(date: string) {
  return date.slice(0, 7)
}

function inMonth(transaction: Transaction, month: string) {
  return transaction.date.startsWith(month)
}

export function summarizeTransactions(transactions: Transaction[]): LedgerTotals {
  const revenueUsd = transactions
    .filter((transaction) => transaction.type === "revenue")
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
  const expenseUsd = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
  const netProfitUsd = revenueUsd - expenseUsd
  const marginPercent = revenueUsd === 0 ? 0 : (netProfitUsd / revenueUsd) * 100

  return {
    revenueUsd,
    expenseUsd,
    netProfitUsd,
    marginPercent,
    rowCount: transactions.length,
    transactionIds: transactions.map((transaction) => transaction.id),
  }
}

export function monthlySeries(transactions: Transaction[]) {
  const months = Array.from(new Set(transactions.map((transaction) => monthKey(transaction.date)))).sort()

  return months.map((month) => {
    const monthTransactions = transactions.filter((transaction) => inMonth(transaction, month))
    const totals = summarizeTransactions(monthTransactions)

    return {
      month,
      label: formatMonthLabel(month),
      revenue: Math.round(totals.revenueUsd),
      expenses: Math.round(totals.expenseUsd),
      netProfit: Math.round(totals.netProfitUsd),
      marginPercent: Number(totals.marginPercent.toFixed(1)),
    }
  })
}

export function mrrForTransactions(transactions: Transaction[]) {
  return transactions
    .filter(
      (transaction) => transaction.type === "revenue" && transaction.recurring
    )
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
}

export function buildMrrTrend(transactions: Transaction[]) {
  const months = Array.from(new Set(transactions.map((transaction) => monthKey(transaction.date)))).sort()
  let previous = 0

  return months.map((month) => {
    const monthTransactions = transactions.filter((transaction) => inMonth(transaction, month))
    const endingMrr = mrrForTransactions(monthTransactions)
    const delta = endingMrr - previous
    const point = {
      month,
      label: formatMonthLabel(month),
      newMrr: delta > 0 ? Math.round(delta * 0.7) : 0,
      expansionMrr: delta > 0 ? Math.round(delta * 0.3) : 0,
      churnMrr: delta < 0 ? Math.abs(Math.round(delta)) : 0,
      endingMrr: Math.round(endingMrr),
    }
    previous = endingMrr

    return point
  })
}

export function buildDepartmentRollups(
  transactions: Transaction[],
  previousTransactions: Transaction[],
  departments: Department[],
  people: Person[]
) {
  return departments.map((department) => {
    const departmentTransactions = transactions.filter(
      (transaction) => transaction.departmentId === department.id
    )
    const previousDepartmentTransactions = previousTransactions.filter(
      (transaction) => transaction.departmentId === department.id
    )
    const totals = summarizeTransactions(departmentTransactions)
    const previousTotals = summarizeTransactions(previousDepartmentTransactions)
    const contributionMarginUsd = totals.revenueUsd - totals.expenseUsd
    const marginPercent =
      totals.revenueUsd === 0 ? 0 : (contributionMarginUsd / totals.revenueUsd) * 100
    const change = percentChange(contributionMarginUsd, previousTotals.netProfitUsd)

    return {
      department,
      revenueUsd: totals.revenueUsd,
      expenseUsd: totals.expenseUsd,
      contributionMarginUsd,
      marginPercent,
      headcount: people.filter(
        (person) => person.departmentId === department.id && person.status === "active"
      ).length,
      monthlyBudgetUsd: department.monthlyBudgetUsd,
      budgetUsedPercent:
        department.monthlyBudgetUsd === 0
          ? 0
          : (totals.expenseUsd / department.monthlyBudgetUsd) * 100,
      trend: directionFromChange(change),
      transactionIds: departmentTransactions.map((transaction) => transaction.id),
    } satisfies DepartmentRollup
  })
}

export function buildPeopleMetrics({
  people,
  departments,
  transactions,
  filters = DEFAULT_MONTH_FILTERS,
}: {
  people: Person[]
  departments: Department[]
  transactions: Transaction[]
  filters?: TransactionFilters
}): PeopleMetrics {
  const activePeople = people.filter((person) => person.status === "active")
  const filteredTransactions = filterTransactions(transactions, filters)
  const revenueUsd = filteredTransactions
    .filter((transaction) => transaction.type === "revenue")
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
  const linkedTransactionIds = new Set(activePeople.flatMap((person) => person.transactionIds))
  const linkedLedgerCostUsd = transactions
    .filter((transaction) => linkedTransactionIds.has(transaction.id))
    .reduce((total, transaction) => total + amountToUsd(transaction), 0)
  const peopleCostUsd = activePeople.reduce((total, person) => total + person.costUsd, 0)

  return {
    activeHeadcount: activePeople.length,
    employeeCount: activePeople.filter((person) => person.type === "employee").length,
    contractorCount: activePeople.filter((person) => person.type === "contractor").length,
    peopleCostUsd,
    linkedLedgerCostUsd,
    revenueUsd,
    payrollAsRevenuePercent: revenueUsd === 0 ? 0 : (peopleCostUsd / revenueUsd) * 100,
    revenuePerHeadUsd: activePeople.length === 0 ? 0 : revenueUsd / activePeople.length,
    unlinkedPeopleCount: activePeople.filter((person) => person.transactionIds.length === 0).length,
    departmentCosts: departments.map((department) => {
      const departmentPeople = activePeople.filter(
        (person) => person.departmentId === department.id
      )
      const departmentTransactionIds = departmentPeople.flatMap(
        (person) => person.transactionIds
      )
      const departmentRows = filteredTransactions.filter(
        (transaction) => transaction.departmentId === department.id
      )
      const departmentRevenueUsd = departmentRows
        .filter((transaction) => transaction.type === "revenue")
        .reduce((total, transaction) => total + amountToUsd(transaction), 0)
      const peopleCost = departmentPeople.reduce(
        (total, person) => total + person.costUsd,
        0
      )
      const ledgerCost = transactions
        .filter((transaction) => departmentTransactionIds.includes(transaction.id))
        .reduce((total, transaction) => total + amountToUsd(transaction), 0)

      return {
        departmentId: department.id,
        department: department.name,
        headcount: departmentPeople.length,
        employeeCount: departmentPeople.filter((person) => person.type === "employee").length,
        contractorCount: departmentPeople.filter((person) => person.type === "contractor").length,
        peopleCostUsd: peopleCost,
        linkedLedgerCostUsd: ledgerCost,
        revenueUsd: departmentRevenueUsd,
        revenuePerHeadUsd:
          departmentPeople.length === 0 ? 0 : departmentRevenueUsd / departmentPeople.length,
        payrollAsRevenuePercent:
          departmentRevenueUsd === 0 ? 0 : (peopleCost / departmentRevenueUsd) * 100,
        transactionIds: departmentTransactionIds,
      }
    }),
  }
}

export function buildCalendarMetrics({
  events,
  recurringItems,
  startDate = "2026-07-01",
  endDate = "2026-07-30",
}: {
  events: CalendarEvent[]
  recurringItems: RecurringItem[]
  startDate?: string
  endDate?: string
}): CalendarMetrics {
  const windowEvents = events
    .filter((event) => event.date >= startDate && event.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  const inflowTypes: CalendarEvent["type"][] = ["retainer", "invoice_due"]
  const outflowTypes: CalendarEvent["type"][] = ["payroll", "renewal", "tax"]
  const expectedInflowUsd = windowEvents
    .filter((event) => inflowTypes.includes(event.type))
    .reduce((total, event) => total + event.amountUsd, 0)
  const scheduledOutflowUsd = windowEvents
    .filter((event) => outflowTypes.includes(event.type))
    .reduce((total, event) => total + event.amountUsd, 0)
  const eventTypes = Array.from(new Set(windowEvents.map((event) => event.type)))

  return {
    startDate,
    endDate,
    events: windowEvents,
    expectedInflowUsd,
    scheduledOutflowUsd,
    cashNeededUsd: scheduledOutflowUsd,
    netScheduledCashUsd: expectedInflowUsd - scheduledOutflowUsd,
    eventsByType: eventTypes.map((type) => {
      const typeEvents = windowEvents.filter((event) => event.type === type)
      return {
        type,
        count: typeEvents.length,
        amountUsd: typeEvents.reduce((total, event) => total + event.amountUsd, 0),
      }
    }),
    recurringGenerationPreview: recurringItems.map((item) => {
      const matchedEvent = windowEvents.find(
        (event) => event.recurringItemId === item.id
      )

      return {
        id: item.id,
        template: item.template,
        nextRun: item.nextRun,
        amountUsd: amountToUsd(item),
        type: item.type,
        idempotencyKey: item.idempotencyKey,
        calendarEventId: matchedEvent?.id ?? null,
      }
    }),
  }
}

export function buildDashboardMetrics({
  transactions,
  departments,
  categories,
  clients,
  people,
  filters = DEFAULT_MONTH_FILTERS,
}: {
  transactions: Transaction[]
  departments: Department[]
  categories: Category[]
  clients: Client[]
  people: Person[]
  filters?: TransactionFilters
}): DashboardMetrics {
  const currentTransactions = filterTransactions(transactions, filters, clients)
  const previousFilters = previousPeriod(filters)
  const previousTransactions = filterTransactions(transactions, previousFilters, clients)
  const totals = summarizeTransactions(currentTransactions)
  const previousTotals = summarizeTransactions(previousTransactions)
  const mrr = mrrForTransactions(currentTransactions)
  const previousMrr = mrrForTransactions(previousTransactions)
  const assumedCashUsd = 92000
  const burnRateUsd = Math.max(totals.expenseUsd - totals.revenueUsd, totals.expenseUsd * 0.35)
  const runwayMonths = burnRateUsd === 0 ? 24 : assumedCashUsd / burnRateUsd
  const previousRunway =
    previousTotals.expenseUsd === 0
      ? 24
      : assumedCashUsd / Math.max(previousTotals.expenseUsd - previousTotals.revenueUsd, previousTotals.expenseUsd * 0.35)
  const anomalyTransactions = currentTransactions.filter(
    (transaction) =>
      transaction.type === "expense" &&
      (amountToUsd(transaction) >= 3000 || transaction.departmentId === "dept_marketing")
  )
  const anomalyFilters: TransactionFilters = {
    ...filters,
    type: "expense",
  }

  const kpis: KpiMetric[] = [
    {
      label: "Net profit",
      value: formatCurrency(totals.netProfitUsd),
      numericValue: totals.netProfitUsd,
      changeLabel: `${formatPercent(percentChange(totals.netProfitUsd, previousTotals.netProfitUsd))} vs previous period`,
      direction: directionFromChange(percentChange(totals.netProfitUsd, previousTotals.netProfitUsd)),
      trace: { transactionIds: totals.transactionIds, filters: exactLedgerFilters(filters, totals.transactionIds) },
    },
    {
      label: "Net margin",
      value: formatPercent(totals.marginPercent),
      numericValue: totals.marginPercent,
      changeLabel: `${formatPercent(totals.marginPercent - previousTotals.marginPercent)} point movement`,
      direction: directionFromChange(totals.marginPercent - previousTotals.marginPercent),
      trace: { transactionIds: totals.transactionIds, filters: exactLedgerFilters(filters, totals.transactionIds) },
    },
    {
      label: "MRR",
      value: formatCurrency(mrr),
      numericValue: mrr,
      changeLabel: `${formatPercent(percentChange(mrr, previousMrr))} vs previous period`,
      direction: directionFromChange(percentChange(mrr, previousMrr)),
      trace: {
        transactionIds: currentTransactions
          .filter((transaction) => transaction.type === "revenue" && transaction.recurring)
          .map((transaction) => transaction.id),
        filters: exactLedgerFilters(
          { ...filters, type: "revenue" },
          currentTransactions
            .filter((transaction) => transaction.type === "revenue" && transaction.recurring)
            .map((transaction) => transaction.id)
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
        transactionIds: currentTransactions
          .filter((transaction) => transaction.type === "expense")
          .map((transaction) => transaction.id),
        filters: exactLedgerFilters(
          { ...filters, type: "expense" },
          currentTransactions
            .filter((transaction) => transaction.type === "expense")
            .map((transaction) => transaction.id)
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

  const revenueParents = parentCategories(categories, "revenue")
  const expenseParents = parentCategories(categories, "expense")
  const currentRevenue = currentTransactions.filter(
    (transaction) => transaction.type === "revenue"
  )
  const currentExpenses = currentTransactions.filter(
    (transaction) => transaction.type === "expense"
  )
  const totalClientRevenue = currentRevenue.reduce(
    (total, transaction) => total + amountToUsd(transaction),
    0
  )
  const departmentRollups = buildDepartmentRollups(
    currentTransactions,
    previousTransactions,
    departments,
    people
  )

  const topClients = clients
    .map((client) => {
      const rows = currentRevenue.filter((transaction) => transaction.clientId === client.id)
      const revenue = rows.reduce((total, transaction) => total + amountToUsd(transaction), 0)

      return {
        clientId: client.id,
        client: client.name,
        revenue,
        concentrationPercent:
          totalClientRevenue === 0 ? 0 : (revenue / totalClientRevenue) * 100,
        transactionIds: rows.map((transaction) => transaction.id),
      }
    })
    .filter((client) => client.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  const marketingRows = currentExpenses.filter(
    (transaction) => transaction.departmentId === "dept_marketing"
  )
  const marketingSpendUsd = marketingRows.reduce(
    (total, transaction) => total + amountToUsd(transaction),
    0
  )
  const newRevenueRows = currentRevenue.filter(
    (transaction) => transaction.categoryId === "cat_rev_build" || transaction.categoryId === "cat_rev_consulting"
  )
  const newRevenueUsd = newRevenueRows.reduce(
    (total, transaction) => total + amountToUsd(transaction),
    0
  )
  const assumedNewCustomers = Math.max(1, new Set(newRevenueRows.map((row) => row.clientId)).size)
  const cacUsd = marketingSpendUsd / assumedNewCustomers
  const averageMrrUsd = clients.length === 0
    ? 0
    : clients.reduce((total, client) => total + client.mrrUsd, 0) /
      Math.max(1, clients.filter((client) => client.mrrUsd > 0).length)
  const ltvUsd = averageMrrUsd * Math.max(0.1, totals.marginPercent / 100) * 18
  const ltvToCac = cacUsd === 0 ? 0 : ltvUsd / cacUsd
  const paybackMonths = mrr === 0 || totals.marginPercent <= 0
    ? 0
    : cacUsd / ((mrr / Math.max(1, clients.filter((client) => client.mrrUsd > 0).length)) * (totals.marginPercent / 100))

  const anomalies = [
    {
      id: "anom_marketing",
      label: "Marketing spend should be tested against CAC",
      severity: "watch" as const,
      transactionIds: currentTransactions
        .filter((transaction) => transaction.departmentId === "dept_marketing")
        .map((transaction) => transaction.id),
      href: buildLedgerHref({ ...filters, departmentId: "dept_marketing", type: "expense" }),
    },
    {
      id: "anom_dev_cost",
      label: "Development cost base is the heaviest expense line",
      severity: "risk" as const,
      transactionIds: currentTransactions
        .filter((transaction) => transaction.departmentId === "dept_development" && transaction.type === "expense")
        .map((transaction) => transaction.id),
      href: buildLedgerHref({ ...filters, departmentId: "dept_development", type: "expense" }),
    },
    {
      id: "anom_concentration",
      label: "Top client concentration is visible in June revenue",
      severity: "watch" as const,
      transactionIds: topClients[0]?.transactionIds ?? [],
      href: buildLedgerHref({ ...filters, clientOrVendor: topClients[0]?.clientId }),
    },
  ].filter((anomaly) => anomaly.transactionIds.length > 0)

  return {
    filters,
    totals,
    previousTotals,
    kpis,
    monthlySeries: monthlySeries(transactions),
    mrrTrend: buildMrrTrend(transactions),
    revenueByDepartment: departments
      .map((department) => {
        const rows = currentRevenue.filter(
          (transaction) => transaction.departmentId === department.id
        )
        return {
          departmentId: department.id,
          department: department.name,
          revenue: rows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
          transactionIds: rows.map((transaction) => transaction.id),
        }
      })
      .filter((row) => row.revenue > 0),
    expenseByCategory: expenseParents
      .map((category) => {
        const rows = currentExpenses.filter(
          (transaction) => transaction.categoryId === category.id
        )
        return {
          categoryId: category.id,
          category: category.name,
          expense: rows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
          transactionIds: rows.map((transaction) => transaction.id),
        }
      })
      .filter((row) => row.expense > 0),
    revenueTypeSplit: revenueParents
      .map((category) => {
        const rows = currentRevenue.filter(
          (transaction) => transaction.categoryId === category.id
        )
        return {
          categoryId: category.id,
          category: category.name,
          revenue: rows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
          transactionIds: rows.map((transaction) => transaction.id),
        }
      })
      .filter((row) => row.revenue > 0),
    topClients,
    departmentRollups,
    budgetVsActual: departmentRollups.map((rollup) => ({
      departmentId: rollup.department.id,
      department: rollup.department.name,
      budget: rollup.monthlyBudgetUsd,
      actual: rollup.expenseUsd,
      transactionIds: rollup.transactionIds,
    })),
    cashRunway: {
      assumedCashUsd,
      burnRateUsd,
      runwayMonths,
      previousRunwayMonths: previousRunway,
      transactionIds: currentExpenses.map((transaction) => transaction.id),
      filters: exactLedgerFilters(
        { ...filters, type: "expense" },
        currentExpenses.map((transaction) => transaction.id)
      ),
    },
    growthEfficiency: {
      marketingSpendUsd,
      newRevenueUsd,
      cacUsd,
      ltvUsd,
      ltvToCac,
      paybackMonths,
      assumptions: [
        "CAC uses current-period marketing spend divided by new one-off/consulting clients.",
        "LTV uses average active MRR, current net margin, and an 18-month expected relationship.",
        "Payback uses MRR gross margin and is labelled directional until CRM attribution is connected.",
      ],
      transactionIds: marketingRows.map((transaction) => transaction.id),
      filters: exactLedgerFilters(
        { ...filters, type: "expense", departmentId: "dept_marketing" },
        marketingRows.map((transaction) => transaction.id)
      ),
    },
    anomalies,
    weeklyActions: [
      {
        title: "Review development cost base",
        detail: `${formatCurrency(
          departmentRollups.find((rollup) => rollup.department.id === "dept_development")
            ?.expenseUsd ?? 0
        )} in June development expenses`,
        href: buildLedgerHref({ ...filters, departmentId: "dept_development", type: "expense" }),
      },
      {
        title: "Test Meta spend against CAC",
        detail: `${formatCurrency(
          currentTransactions
            .filter((transaction) => transaction.departmentId === "dept_marketing")
            .reduce((total, transaction) => total + amountToUsd(transaction), 0)
        )} marketing spend to validate`,
        href: buildLedgerHref({ ...filters, departmentId: "dept_marketing", type: "expense" }),
      },
      {
        title: "Confirm low-confidence import rows",
        detail: "Review staged rows before anything touches the ledger",
        href: "/imports",
      },
    ],
  }
}

export function categoryBreakdownForFilters(
  transactions: Transaction[],
  categories: Category[],
  clients: Client[],
  filters: TransactionFilters
) {
  const rows = filterTransactions(transactions, filters, clients)
  const parents = parentCategories(categories, filters.type)

  return parents
    .map((category) => {
      const categoryRows = rows.filter((transaction) => transaction.categoryId === category.id)
      return {
        categoryId: category.id,
        category: categoryName(categories, category.id),
        amount: categoryRows.reduce((total, transaction) => total + amountToUsd(transaction), 0),
        transactionIds: categoryRows.map((transaction) => transaction.id),
      }
    })
    .filter((row) => row.amount > 0)
}
