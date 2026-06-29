import { and, eq } from "drizzle-orm"

import type { AiSuggestion } from "@/domain/types"
import type { AuthOrganizationContext } from "@/lib/api/auth"
import { NotFoundError } from "@/lib/api/errors"

import { db } from "../index"
import { aiSuggestions, auditLogs } from "../schema"
import { toAiSuggestion } from "../queries/ai"

export type CreateAiSuggestionInput = {
  confidence: number
  feature: "categorization" | "natural_language_query" | "anomaly" | "briefing" | "forecast" | "ocr"
  filterQuery?: string | null
  proposedAction: string
  reviewState?: "draft" | "applied" | "dismissed" | "needs_human"
  summary: string
  title: string
  transactionIds?: string[]
}

export async function createAiSuggestion(
  context: AuthOrganizationContext,
  input: CreateAiSuggestionInput
): Promise<AiSuggestion> {
  const [created] = await db
    .insert(aiSuggestions)
    .values({
      confidence: Math.min(1, Math.max(0, input.confidence)),
      feature: input.feature,
      filterQuery: input.filterQuery ?? null,
      organizationId: context.organization.id,
      proposedAction: input.proposedAction,
      reviewState: input.reviewState ?? "draft",
      summary: input.summary,
      title: input.title,
      transactionIds: input.transactionIds ?? [],
    })
    .returning()

  await db.insert(auditLogs).values({
    action: "ai_suggestion.create",
    actorId: context.user.id,
    entityId: created.id,
    entityType: "ai_suggestion",
    metadata: { after: created },
    organizationId: context.organization.id,
  })

  return toAiSuggestion(created)
}

export async function updateAiSuggestionReviewState(
  context: AuthOrganizationContext,
  id: string,
  reviewState: "applied" | "dismissed" | "draft" | "needs_human"
): Promise<AiSuggestion> {
  const [before] = await db
    .select()
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.organizationId, context.organization.id), eq(aiSuggestions.id, id)))
    .limit(1)

  if (!before) {
    throw new NotFoundError("AI suggestion not found")
  }

  const [updated] = await db
    .update(aiSuggestions)
    .set({ reviewState, updatedAt: new Date() })
    .where(and(eq(aiSuggestions.organizationId, context.organization.id), eq(aiSuggestions.id, id)))
    .returning()

  await db.insert(auditLogs).values({
    action: "ai_suggestion.review_state.update",
    actorId: context.user.id,
    entityId: id,
    entityType: "ai_suggestion",
    metadata: { after: updated, before },
    organizationId: context.organization.id,
  })

  return toAiSuggestion(updated)
}
