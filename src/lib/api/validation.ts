import { z } from "zod"

import { BadRequestError } from "./errors"

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)

  if (!result.success) {
    throw new BadRequestError(
      "validation_error",
      "Invalid request body",
      formatZodError(result.error)
    )
  }

  return result.data
}

export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query)

  if (!result.success) {
    throw new BadRequestError(
      "validation_error",
      "Invalid query parameters",
      formatZodError(result.error)
    )
  }

  return result.data
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))
}
