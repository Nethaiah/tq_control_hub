import type { Transaction } from "@/domain/types"

export const REPORTING_CURRENCY = "USD" as const
export const OPERATING_CURRENCY = "AED" as const

export function amountToUsd(transaction: Pick<Transaction, "amount" | "fxRateToUsd">) {
  return transaction.amount * transaction.fxRateToUsd
}

export function convertAmountToUsd(amount: number, fxRateToUsd: number) {
  return amount * fxRateToUsd
}

export function formatCurrency(value: number, currency = REPORTING_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value)
}

export function formatCompactCurrency(value: number, currency = REPORTING_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}
