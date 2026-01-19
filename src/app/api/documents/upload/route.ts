/**
 * POST /api/documents/upload - Upload document or URL
 * Handles file uploads and URL submissions for document processing
 * Requirements: 13.4, 13.6
 */

import { NextRequest, NextResponse } from "next/server";
import { DocumentService } from "@/services/document.service";
import { UploadDocumentSchema } from "@/lib/schemas";
import { errorHandler } from "@/lib/error-handler";

const documentService = new DocumentService();

/**
 * POST /api/documents/upload
 * Handles document uploads (files or URLs)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData();

    // Extract projectId from form data
    const projectId = formData.get("projectId") as string;
    const url = formData.get("url") as string;
    const file = formData.get("file") as File;

    // Validate request with Zod schema
    const validationResult = UploadDocumentSchema.safeParse({
      body: { projectId },
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    let document;

    if (url) {
      // Handle URL upload
      document = await documentService.uploadUrl(projectId, url);
    } else if (file) {
      // Handle file upload
      // Convert File to buffer format expected by DocumentService
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileData = {
        name: file.name,
        type: file.type,
        buffer: buffer,
      };

      document = await documentService.uploadDocument(projectId, fileData);
    } else {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: "Either 'file' or 'url' must be provided",
        },
        { status: 400 }
      );
    }

    // Trigger async document processing
    // Note: In a production app, this would typically be done with a job queue
    // For now, we'll process synchronously for simplicity
    try {
      await documentService.processDocument(document.id);
    } catch (processError) {
      // Log processing error but don't fail the upload
      console.error(
        `Document processing failed for ${document.id}:`,
        processError
      );
    }

    // Return success response
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return errorHandler(error);
  }
}
