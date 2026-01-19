/**
 * ProjectService - Manages project lifecycle operations
 * Handles project creation, retrieval, and deletion with cascade operations
 * Requirements: 1.1, 1.2, 1.3
 */

import { prisma } from "../../lib/prisma";
import { NotFoundError, DatabaseError, VectorStoreError } from "../lib/errors";
import { ChromaClient } from "chromadb";

/**
 * Project interface matching Prisma schema
 */
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

/**
 * Extended project interface with document count
 */
export interface ProjectWithDocuments extends Project {
  documentCount: number;
}

/**
 * Service class for project management operations
 */
export class ProjectService {
  private chromaClient: ChromaClient;

  constructor() {
    // Initialize ChromaDB client for vector store operations
    const chromaHost = process.env.CHROMA_HOST || "localhost";
    const chromaPort = process.env.CHROMA_PORT || "8000";
    this.chromaClient = new ChromaClient({
      path: `http://${chromaHost}:${chromaPort}`,
    });
  }

  /**
   * Creates a new project with a unique identifier
   * Requirement 1.1: Generate unique project identifier and store in database
   *
   * @param name - The name of the project
   * @returns Promise<Project> - The created project with generated ID
   * @throws ValidationError if name is invalid
   * @throws DatabaseError if database operation fails
   */
  async createProject(name: string): Promise<Project> {
    try {
      // Prisma will automatically generate a unique CUID for the id field
      const project = await prisma.project.create({
        data: {
          name,
        },
      });

      return {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
      };
    } catch (error) {
      // Handle Prisma-specific errors
      if (error && typeof error === "object" && "code" in error) {
        const prismaError = error as { code: string; meta?: any };
        if (prismaError.code === "P2002") {
          throw new DatabaseError("Project with this name already exists");
        }
      }
      throw new DatabaseError(
        `Failed to create project: ${(error as Error).message}`
      );
    }
  }

  /**
   * Retrieves project details including document count
   * Requirement 1.2: Return project name, creation timestamp, and document count
   *
   * @param id - The unique project identifier
   * @returns Promise<ProjectWithDocuments> - Project details with document count
   * @throws NotFoundError if project doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async getProject(id: string): Promise<ProjectWithDocuments> {
    try {
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          documents: true,
        },
      });

      if (!project) {
        throw new NotFoundError(`Project with id ${id} not found`);
      }

      return {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        documentCount: project.documents.length,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to retrieve project: ${(error as Error).message}`
      );
    }
  }

  /**
   * Deletes a project and all associated data
   * Requirement 1.3: Cascade delete from both Vector_Database and Metadata_Database
   *
   * @param id - The unique project identifier
   * @returns Promise<void>
   * @throws NotFoundError if project doesn't exist
   * @throws DatabaseError if metadata database operation fails
   * @throws VectorStoreError if vector database operation fails
   */
  async deleteProject(id: string): Promise<void> {
    try {
      // First verify the project exists
      const project = await prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        throw new NotFoundError(`Project with id ${id} not found`);
      }

      // Delete from vector database (ChromaDB)
      // Collection name follows the pattern: project_{projectId}
      const collectionName = `project_${id}`;

      try {
        await this.chromaClient.deleteCollection({ name: collectionName });
      } catch (chromaError) {
        // If collection doesn't exist, that's okay - it might not have been created yet
        // Only throw if it's a different error
        const errorMessage = (chromaError as Error).message || "";
        if (
          !errorMessage.includes("does not exist") &&
          !errorMessage.includes("not found")
        ) {
          throw new VectorStoreError(
            `Failed to delete vector collection: ${errorMessage}`
          );
        }
      }

      // Delete from metadata database (PostgreSQL via Prisma)
      // Cascade delete is configured in Prisma schema, so documents will be deleted automatically
      await prisma.project.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof VectorStoreError) {
        throw error;
      }

      // Handle Prisma-specific errors
      if (error && typeof error === "object" && "code" in error) {
        const prismaError = error as { code: string };
        if (prismaError.code === "P2025") {
          throw new NotFoundError(`Project with id ${id} not found`);
        }
      }

      throw new DatabaseError(
        `Failed to delete project: ${(error as Error).message}`
      );
    }
  }
}
