/**
 * Error handling infrastructure for RAG Chatbot Backend
 * Implements custom error classes for structured error responses
 * Requirements: 14.1
 */

/**
 * Base error class for all application errors
 * Provides consistent structure with status code and error code
 */
export class AppError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for invalid input data
 * HTTP 400 Bad Request
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/**
 * Not found error for missing resources
 * HTTP 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

/**
 * Conflict error for duplicate resources
 * HTTP 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

/**
 * Database error for Prisma/PostgreSQL failures
 * HTTP 500 Internal Server Error
 */
export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500, "DATABASE_ERROR");
  }
}

/**
 * Vector store error for ChromaDB failures
 * HTTP 500 Internal Server Error
 */
export class VectorStoreError extends AppError {
  constructor(message: string) {
    super(message, 500, "VECTOR_STORE_ERROR");
  }
}

/**
 * LLM error for language model invocation failures
 * HTTP 500 Internal Server Error
 */
export class LLMError extends AppError {
  constructor(message: string) {
    super(message, 500, "LLM_ERROR");
  }
}

/**
 * Quota exceeded error for API rate limits
 * HTTP 429 Too Many Requests
 */
export class QuotaExceededError extends AppError {
  constructor(message: string) {
    super(message, 429, "QUOTA_EXCEEDED");
  }
}

/**
 * Timeout error for operations that exceed time limits
 * HTTP 504 Gateway Timeout
 */
export class TimeoutError extends AppError {
  constructor(message: string) {
    super(message, 504, "TIMEOUT");
  }
}

/**
 * Service unavailable error for external service failures
 * HTTP 503 Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
