/**
 * GET /api/projects/[id] - Retrieve project details
 * DELETE /api/projects/[id] - Delete project and all associated data
 * Requirements: 13.2, 13.3
 */

import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/services/project.service";
import { GetProjectSchema, DeleteProjectSchema } from "@/lib/schemas";
import { errorHandler } from "@/lib/error-handler";
import { NotFoundError } from "@/lib/errors";

const projectService = new ProjectService();

/**
 * GET /api/projects/[id]
 * Retrieves project details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate project ID parameter
    const validationResult = GetProjectSchema.safeParse({
      params: { id: params.id },
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

    const { id } = validationResult.data.params;

    // Retrieve project using service
    const project = await projectService.getProject(id);

    // Return success response
    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    return errorHandler(error);
  }
}

/**
 * DELETE /api/projects/[id]
 * Deletes a project and all associated documents
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate project ID parameter
    const validationResult = DeleteProjectSchema.safeParse({
      params: { id: params.id },
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

    const { id } = validationResult.data.params;

    // Delete project using service (cascade deletes documents)
    await projectService.deleteProject(id);

    // Return success response
    return NextResponse.json(
      { message: "Project deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return errorHandler(error);
  }
}
