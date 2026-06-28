export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class BadRequestError extends ApiError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 400, details)
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Permission denied") {
    super("forbidden", message, 403)
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found") {
    super("not_found", message, 404)
  }
}

export class ConflictError extends ApiError {
  constructor(message = "Resource conflict") {
    super("conflict", message, 409)
  }
}

export class UnprocessableError extends ApiError {
  constructor(message = "Invalid business rule", details?: unknown) {
    super("unprocessable", message, 422, details)
  }
}
