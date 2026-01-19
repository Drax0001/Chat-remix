/**
 * Example usage of error handling infrastructure
 * This file demonstrates how to use custom errors and the error handler
 */

import { errorHandler } from "./error-handler";
import {
  ValidationError,
  NotFoundError,
  DatabaseError,
  VectorStoreError,
  LLMError,
  QuotaExceededError,
  TimeoutError,
  ServiceUnavailableError,
} from "./errors";
import { z } from "zod";

/**
 * Example API route handler demonstrating error handling
 */
export async function exampleApiRoute(request: Request): Promise<Response> {
  try {
    // Example: Validate request body
    const schema = z.object({
      name: z.string().min(1),
    });

    const body = await request.json();
    const data = schema.parse(body);

    // Example: Throw custom errors based on business logic
    if (data.name === "invalid") {
      throw new ValidationError("Invalid name provided");
    }

    if (data.name === "notfound") {
      throw new NotFoundError("Resource not found");
    }

    // Success response
    return Response.json({ success: true, data });
  } catch (error) {
    // Use centralized error handler
    return errorHandler(error);
  }
}

/**
 * Example service method demonstrating error throwing
 */
export async function exampleServiceMethod(id: string): Promise<void> {
  // Example: Database operation
  try {
    // Simulated database call
    const result = null;

    if (!result) {
      throw new NotFoundError(`Resource with id ${id} not found`);
    }
  } catch (error) {
    // Re-throw as DatabaseError if it's a database-specific error
    if (error instanceof Error && error.message.includes("connection")) {
      throw new DatabaseError("Failed to connect to database");
    }
    throw error;
  }
}

/**
 * Example vector store operation
 */
export async function exampleVectorStoreOperation(): Promise<void> {
  try {
    // Simulated ChromaDB operation
    throw new Error("ChromaDB connection failed");
  } catch (error) {
    throw new VectorStoreError("Failed to access vector store");
  }
}

/**
 * Example LLM invocation
 */
export async function exampleLLMInvocation(): Promise<string> {
  try {
    // Simulated LLM call
    throw new Error("API quota exceeded");
  } catch (error) {
    if (error instanceof Error && error.message.includes("quota")) {
      throw new QuotaExceededError("LLM API quota exceeded");
    }
    if (error instanceof Error && error.message.includes("timeout")) {
      throw new TimeoutError("LLM request timed out");
    }
    throw new LLMError("Failed to generate response");
  }
}

/**
 * Example external service call
 */
export async function exampleExternalServiceCall(): Promise<void> {
  try {
    // Simulated external service call
    throw new Error("Service unavailable");
  } catch (error) {
    throw new ServiceUnavailableError(
      "External service is temporarily unavailable"
    );
  }
}

// Example error responses that would be returned:

// ValidationError:
// Status: 400
// Body: { error: { code: "VALIDATION_ERROR", message: "Invalid name provided" } }

// NotFoundError:
// Status: 404
// Body: { error: { code: "NOT_FOUND", message: "Resource not found" } }

// DatabaseError:
// Status: 500
// Body: { error: { code: "DATABASE_ERROR", message: "Failed to connect to database" } }

// VectorStoreError:
// Status: 500
// Body: { error: { code: "VECTOR_STORE_ERROR", message: "Failed to access vector store" } }

// LLMError:
// Status: 500
// Body: { error: { code: "LLM_ERROR", message: "Failed to generate response" } }

// QuotaExceededError:
// Status: 429
// Body: { error: { code: "QUOTA_EXCEEDED", message: "LLM API quota exceeded" } }

// TimeoutError:
// Status: 504
// Body: { error: { code: "TIMEOUT", message: "LLM request timed out" } }

// ServiceUnavailableError:
// Status: 503
// Body: { error: { code: "SERVICE_UNAVAILABLE", message: "External service is temporarily unavailable" } }

// Zod validation error:
// Status: 400
// Body: { error: { code: "VALIDATION_ERROR", message: "Invalid request payload", details: [...] } }
