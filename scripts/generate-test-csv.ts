import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const outputPath = join(process.cwd(), "fixtures", "imports", "techquarters-june-expenses.csv")

const rows = [
  ["Date", "Description", "Amount", "Currency", "Vendor"],
  ["2026-06-01", "Engineer salary", "5500", "USD", "Internal"],
  ["2026-06-01", "Designer salary", "3800", "USD", "Internal"],
  ["2026-06-02", "Meta ad spend", "4200", "USD", "Meta"],
  ["2026-06-04", "Automation platform", "120", "USD", "n8n"],
  ["2026-06-04", "Database & hosting", "260", "USD", "Supabase / Vercel"],
  ["2026-06-06", "AI API usage", "740", "USD", "Claude API"],
  ["2026-06-12", "Contractor, build", "2400", "USD", "Freelancer"],
  ["2026-06-20", "Accounting", "600", "USD", "Accountant"],
  ["2026-06-20", "Accounting", "600", "USD", "Accountant"],
  ["not-a-date", "Bad row for validation", "", "EUR", "Unknown"],
]

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`)

console.log(`Generated ${outputPath}`)
