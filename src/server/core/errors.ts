/**
 * Application error type + codes, mirrors the FastAPI `core/errors.py`.
 * `AppError` is mapped to the error envelope by `http/with-envelope.ts`.
 */

export enum ErrorCode {
  AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN",
  AUTH_ROLE_MISMATCH = "AUTH_ROLE_MISMATCH",
  AUTH_ACCOUNT_INACTIVE = "AUTH_ACCOUNT_INACTIVE",
  AUTH_PERMISSION_DENIED = "AUTH_PERMISSION_DENIED",
  AUTH_PRINCIPAL_NOT_FOUND = "AUTH_PRINCIPAL_NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  PAYMENT_PROVIDER_ERROR = "PAYMENT_PROVIDER_ERROR",
  PAYMENT_WEBHOOK_INVALID = "PAYMENT_WEBHOOK_INVALID",
  DOCUMENT_UPLOAD_INVALID = "DOCUMENT_UPLOAD_INVALID",
}

export interface AppErrorInit {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  headers?: Record<string, string>;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor({ status, code, message, details, headers }: AppErrorInit) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
    // Restore prototype chain (transpilation target safety).
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function authInvalidToken(details?: unknown): AppError {
  return new AppError({
    status: 401,
    code: ErrorCode.AUTH_INVALID_TOKEN,
    message: "Invalid token",
    details,
  });
}

export function authRoleMismatch(requiredRole: string, actualRole: string | null): AppError {
  return new AppError({
    status: 403,
    code: ErrorCode.AUTH_ROLE_MISMATCH,
    message: "Token role mismatch",
    details: { required_role: requiredRole, actual_role: actualRole },
  });
}

export function authPermissionDenied(permissionKey: string): AppError {
  return new AppError({
    status: 403,
    code: ErrorCode.AUTH_PERMISSION_DENIED,
    message: "Insufficient permissions",
    details: { permission_key: permissionKey },
  });
}

export function resourceNotFound(resource: string, resourceId?: string | null): AppError {
  const details: Record<string, string> = { resource };
  if (resourceId) details.resource_id = resourceId;
  return new AppError({
    status: 404,
    code: ErrorCode.RESOURCE_NOT_FOUND,
    message: `${resource} not found`,
    details,
  });
}
