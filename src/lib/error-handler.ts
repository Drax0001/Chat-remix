/**
 * Centralized error handler middleware for API routes
 * Converts errors into structured HTTP responses
 * Requirements: 14.1
 */

import { z } from "zod";
import { AppError } from "./errors";

/**
 * Error response structure
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Centralized error handler that converts errors into structured HTTP responses
 * Handles AppError instances, Zod validation errors, Prisma errors, and unknown errors
 *
 * @param error - The error to handle
 * @returns Response object with appropriate status code and error details
 */
export function errorHandler(error: unknown): Response {
  // Log error for debugging
  console.error("Error occurred:", error);

  // Handle custom AppError instances
  if (error instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
      },
    };

    return Response.json(errorResponse, { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: error.issues,
      },
    };

    return Response.json(errorResponse, { status: 400 });
  }

  // Handle Prisma errors
  if (isPrismaError(error)) {
    return handlePrismaError(error);
  }

  // Handle unknown errors
  const errorResponse: ErrorResponse = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  };

  return Response.json(errorResponse, { status: 500 });
}

/**
 * Type guard to check if error is a Prisma error
 */
function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === "object" &&
    error !== null &&
    "constructor" in error &&
    error.constructor?.name === "PrismaClientKnownRequestError"
  );
}

/**
 * Prisma error interface
 */
interface PrismaError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error: PrismaError): Response {
  // P2002: Unique constraint violation
  if (error.code === "P2002") {
    const errorResponse: ErrorResponse = {
      error: {
        code: "CONFLICT",
        message: "Resource already exists",
      },
    };

    return Response.json(errorResponse, { status: 409 });
  }

  // P2025: Record not found
  if (error.code === "P2025") {
    const errorResponse: ErrorResponse = {
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
      },
    };

    return Response.json(errorResponse, { status: 404 });
  }

  // P2003: Foreign key constraint violation
  if (error.code === "P2003") {
    const errorResponse: ErrorResponse = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid reference to related resource",
      },
    };

    return Response.json(errorResponse, { status: 400 });
  }

  // Generic Prisma error
  const errorResponse: ErrorResponse = {
    error: {
      code: "DATABASE_ERROR",
      message: "Database operation failed",
    },
  };

  return Response.json(errorResponse, { status: 500 });
}
