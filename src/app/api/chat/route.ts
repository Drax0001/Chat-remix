/**
 * POST /api/chat - Process chat queries
 * Handles user questions and returns RAG-powered responses
 * Requirements: 13.5, 13.6
 */

import { NextRequest, NextResponse } from "next/server";
import { ChatService } from "@/services/chat.service";
import { ChatRequestSchema } from "@/lib/schemas";
import { errorHandler } from "@/lib/error-handler";

const chatService = new ChatService();

/**
 * POST /api/chat
 * Processes user chat queries using RAG pipeline
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();

    const validationResult = ChatRequestSchema.safeParse({ body });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { projectId, message } = validationResult.data.body;

    // Process query using ChatService
    const response = await chatService.processQuery({
      projectId,
      message,
    });

    // Return success response
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return errorHandler(error);
  }
}
