/**
 * POST /api/projects - Create a new project
 * Creates a project with the specified name and returns project details
 * Requirements: 13.1, 13.6
 */

import { NextRequest, NextResponse } from "next/server";
import { ProjectService } from "@/services/project.service";
import { CreateProjectSchema } from "@/lib/schemas";
import { errorHandler } from "@/lib/error-handler";

const projectService = new ProjectService();

/**
 * POST /api/projects
 * Creates a new project
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();

    const validationResult = CreateProjectSchema.safeParse({ body });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { name } = validationResult.data.body;

    // Create project using service
    const project = await projectService.createProject(name);

    // Return success response
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return errorHandler(error);
  }
}
