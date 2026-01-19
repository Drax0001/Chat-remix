# Error Handling Infrastructure

This document describes the error handling infrastructure for the RAG Chatbot Backend.

## Overview

The error handling system provides:

- Custom error classes for different error types
- Centralized error handler middleware for API routes
- Structured error responses with consistent format
- Support for Zod validation errors and Prisma database errors

## Custom Error Classes

All custom errors extend the `AppError` base class and include:

- HTTP status code
- Error code (for client-side handling)
- Error message

### Available Error Classes

| Error Class               | Status Code | Error Code          | Use Case                   |
| ------------------------- | ----------- | ------------------- | -------------------------- |
| `ValidationError`         | 400         | VALIDATION_ERROR    | Invalid input data         |
| `NotFoundError`           | 404         | NOT_FOUND           | Resource not found         |
| `ConflictError`           | 409         | CONFLICT            | Duplicate resource         |
| `DatabaseError`           | 500         | DATABASE_ERROR      | Prisma/PostgreSQL failures |
| `VectorStoreError`        | 500         | VECTOR_STORE_ERROR  | ChromaDB failures          |
| `LLMError`                | 500         | LLM_ERROR           | Language model failures    |
| `QuotaExceededError`      | 429         | QUOTA_EXCEEDED      | API rate limits            |
| `TimeoutError`            | 504         | TIMEOUT             | Operation timeout          |
| `ServiceUnavailableError` | 503         | SERVICE_UNAVAILABLE | External service failures  |

## Usage

### In API Routes

```typescript
import { errorHandler } from "@/lib/error-handler";
import { ValidationError, NotFoundError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    // Your API logic here
    const data = await someOperation();

    if (!data) {
      throw new NotFoundError("Resource not found");
    }

    return Response.json(data);
  } catch (error) {
    return errorHandler(error);
  }
}
```

### In Service Layer

```typescript
import { DatabaseError, VectorStoreError } from "@/lib/errors";

export class MyService {
  async getData(id: string) {
    try {
      const result = await prisma.model.findUnique({ where: { id } });

      if (!result) {
        throw new NotFoundError(`Resource ${id} not found`);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError("Failed to retrieve data");
    }
  }
}
```

### With Zod Validation

```typescript
import { z } from "zod";
import { errorHandler } from "@/lib/error-handler";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schema.parse(body); // Throws ZodError if invalid

    // Process valid data
    return Response.json({ success: true });
  } catch (error) {
    // errorHandler automatically handles ZodError
    return errorHandler(error);
  }
}
```

## Error Response Format

All errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional, included for validation errors
  }
}
```

### Examples

**Validation Error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      {
        "path": ["email"],
        "message": "Invalid email format"
      }
    ]
  }
}
```

**Not Found Error:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  }
}
```

**Database Error:**

```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Failed to connect to database"
  }
}
```

## Prisma Error Handling

The error handler automatically converts Prisma errors:

| Prisma Code | HTTP Status | Error Code       | Description                      |
| ----------- | ----------- | ---------------- | -------------------------------- |
| P2002       | 409         | CONFLICT         | Unique constraint violation      |
| P2025       | 404         | NOT_FOUND        | Record not found                 |
| P2003       | 400         | VALIDATION_ERROR | Foreign key constraint violation |
| Other       | 500         | DATABASE_ERROR   | Generic database error           |

## Best Practices

1. **Always use try-catch in API routes**: Wrap your route logic in try-catch and use `errorHandler`
2. **Throw specific errors**: Use the most specific error class for your use case
3. **Provide descriptive messages**: Include context in error messages to help debugging
4. **Don't expose sensitive data**: Error messages should be safe to send to clients
5. **Log errors**: The error handler logs all errors for debugging purposes
6. **Re-throw when appropriate**: In service layers, catch and re-throw with more context

## Testing

When testing error handling:

```typescript
import { ValidationError } from "@/lib/errors";

describe("MyService", () => {
  it("should throw ValidationError for invalid input", async () => {
    const service = new MyService();

    await expect(service.process("")).rejects.toThrow(ValidationError);
  });
});
```

## Requirements

This implementation satisfies:

- **Requirement 14.1**: Structured error responses with status code and message
- **Requirement 14.2**: Logging of document processing errors
- **Requirement 14.3**: Logging of LLM invocation errors
- **Requirement 14.4**: 503 error for Vector_Database connection failures
- **Requirement 14.5**: 503 error for Metadata_Database connection failures
