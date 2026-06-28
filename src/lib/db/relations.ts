import { relations } from "drizzle-orm"

import {
  aiSuggestions,
  appSettings,
  calendarEvents,
  categories,
  clients,
  csvImports,
  csvStagedRows,
  departmentBudgets,
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

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  aiSuggestions: many(aiSuggestions),
  appSettings: one(appSettings),
  calendarEvents: many(calendarEvents),
  categories: many(categories),
  clients: many(clients),
  csvImports: many(csvImports),
  departmentBudgets: many(departmentBudgets),
  departments: many(departments),
  integrations: many(integrationConnections),
  members: many(organizationMembers),
  people: many(people),
  permissionRoles: many(permissionRoles),
  recurringItems: many(recurringItems),
  transactions: many(transactions),
}))

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(organizationMembers),
}))

export const organizationMembersRelations = relations(organizationMembers, ({ many, one }) => ({
  departmentAccess: many(memberDepartmentAccess),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  profile: one(profiles, {
    fields: [organizationMembers.userId],
    references: [profiles.id],
  }),
}))

export const departmentsRelations = relations(departments, ({ many, one }) => ({
  budgets: many(departmentBudgets),
  calendarAccess: many(memberDepartmentAccess),
  organization: one(organizations, {
    fields: [departments.organizationId],
    references: [organizations.id],
  }),
  people: many(people),
  recurringItems: many(recurringItems),
  transactions: many(transactions),
}))

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  children: many(categories),
  organization: one(organizations, {
    fields: [categories.organizationId],
    references: [organizations.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
}))

export const clientsRelations = relations(clients, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  recurringItems: many(recurringItems),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ many, one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  client: one(clients, {
    fields: [transactions.clientId],
    references: [clients.id],
  }),
  department: one(departments, {
    fields: [transactions.departmentId],
    references: [departments.id],
  }),
  organization: one(organizations, {
    fields: [transactions.organizationId],
    references: [organizations.id],
  }),
  people: many(personTransactions),
  subcategory: one(categories, {
    fields: [transactions.subcategoryId],
    references: [categories.id],
  }),
}))

export const peopleRelations = relations(people, ({ many, one }) => ({
  department: one(departments, {
    fields: [people.departmentId],
    references: [departments.id],
  }),
  organization: one(organizations, {
    fields: [people.organizationId],
    references: [organizations.id],
  }),
  transactions: many(personTransactions),
}))

export const personTransactionsRelations = relations(personTransactions, ({ one }) => ({
  person: one(people, {
    fields: [personTransactions.personId],
    references: [people.id],
  }),
  transaction: one(transactions, {
    fields: [personTransactions.transactionId],
    references: [transactions.id],
  }),
}))

export const recurringItemsRelations = relations(recurringItems, ({ one }) => ({
  category: one(categories, {
    fields: [recurringItems.categoryId],
    references: [categories.id],
  }),
  client: one(clients, {
    fields: [recurringItems.clientId],
    references: [clients.id],
  }),
  department: one(departments, {
    fields: [recurringItems.departmentId],
    references: [departments.id],
  }),
  organization: one(organizations, {
    fields: [recurringItems.organizationId],
    references: [organizations.id],
  }),
  subcategory: one(categories, {
    fields: [recurringItems.subcategoryId],
    references: [categories.id],
  }),
}))

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [calendarEvents.organizationId],
    references: [organizations.id],
  }),
  recurringItem: one(recurringItems, {
    fields: [calendarEvents.recurringItemId],
    references: [recurringItems.id],
  }),
  transaction: one(transactions, {
    fields: [calendarEvents.transactionId],
    references: [transactions.id],
  }),
}))

export const csvImportsRelations = relations(csvImports, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [csvImports.organizationId],
    references: [organizations.id],
  }),
  stagedRows: many(csvStagedRows),
}))

export const csvStagedRowsRelations = relations(csvStagedRows, ({ one }) => ({
  import: one(csvImports, {
    fields: [csvStagedRows.importId],
    references: [csvImports.id],
  }),
}))
