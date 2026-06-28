import { NextResponse } from "next/server"

import { ApiError } from "./errors"

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export type ApiFailure = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status })
}

export function created<T>(data: T) {
  return success(data, 201)
}

export function failure(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status }
  )
}

export function unauthorized(code = "unauthorized", message = "Authentication required") {
  return failure(code, message, 401)
}

export function forbidden(code = "forbidden", message = "Permission denied") {
  return failure(code, message, 403)
}

export function notFound(code = "not_found", message = "Resource not found") {
  return failure(code, message, 404)
}

export function conflict(code = "conflict", message = "Resource conflict") {
  return failure(code, message, 409)
}

export function unprocessable(
  code = "unprocessable",
  message = "Invalid business rule",
  details?: unknown
) {
  return failure(code, message, 422, details)
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return failure(error.code, error.message, error.status, error.details)
  }

  console.error("[API Error]", error)
  return failure("internal_error", "Unexpected server error", 500)
}
