/**
 * Zod validation schemas for API endpoints
 * Defines request/response validation for all API endpoints
 * Requirements: 13.6
 */

import { z } from "zod";

/**
 * Schema for creating a new project
 * Validates the request payload for POST /api/projects
 */
export const CreateProjectSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Project name is required")
      .max(100, "Project name must be 100 characters or less")
      .trim(),
  }),
});

/**
 * Response schema for project creation
 */
export const CreateProjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

/**
 * Schema for retrieving a project
 * Validates the URL parameters for GET /api/projects/:id
 */
export const GetProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid("Project ID must be a valid UUID"),
  }),
});

/**
 * Response schema for project retrieval
 */
export const GetProjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  documentCount: z.number().int().min(0),
});

/**
 * Schema for deleting a project
 * Validates the URL parameters for DELETE /api/projects/:id
 */
export const DeleteProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid("Project ID must be a valid UUID"),
  }),
});

/**
 * Response schema for project deletion
 */
export const DeleteProjectResponseSchema = z.object({
  message: z.string(),
});

/**
 * Schema for document upload
 * Validates the request payload for POST /api/documents/upload
 */
export const UploadDocumentSchema = z.object({
  body: z.object({
    projectId: z.string().uuid("Project ID must be a valid UUID"),
    // File upload will be handled separately by Next.js
  }),
});

/**
 * Response schema for document upload
 */
export const UploadDocumentResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  filename: z.string(),
  fileType: z.enum(["pdf", "docx", "txt", "url"]),
  status: z.enum(["pending", "processing", "ready", "failed"]),
  uploadedAt: z.string().datetime(),
});

/**
 * Schema for chat requests
 * Validates the request payload for POST /api/chat
 */
export const ChatRequestSchema = z.object({
  body: z.object({
    projectId: z.string().uuid("Project ID must be a valid UUID"),
    message: z
      .string()
      .min(1, "Message is required")
      .max(10000, "Message must be 10000 characters or less")
      .trim(),
  }),
});

/**
 * Response schema for chat responses
 */
export const ChatResponseSchema = z.object({
  answer: z.string(),
  sourceCount: z.number().int().min(0),
});

/**
 * Type exports for use in API handlers
 */
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;
export type GetProjectRequest = z.infer<typeof GetProjectSchema>;
export type GetProjectResponse = z.infer<typeof GetProjectResponseSchema>;
export type DeleteProjectRequest = z.infer<typeof DeleteProjectSchema>;
export type DeleteProjectResponse = z.infer<typeof DeleteProjectResponseSchema>;
export type UploadDocumentRequest = z.infer<typeof UploadDocumentSchema>;
export type UploadDocumentResponse = z.infer<typeof UploadDocumentResponseSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;