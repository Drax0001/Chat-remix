/**
 * DocumentService - Manages document lifecycle operations
 * Handles document upload, validation, and processing pipeline
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 12.3, 12.4, 12.5
 */

import { prisma } from "../../lib/prisma";
import {
  ValidationError,
  NotFoundError,
  DatabaseError,
  VectorStoreError,
} from "../lib/errors";
import { TextExtractor } from "../lib/text-extractor";
import { TextChunker } from "../lib/text-chunker";
import { getConfig } from "../lib/config";
import { ChromaClient } from "chromadb";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * Document interface matching Prisma schema
 */
export interface Document {
  id: string;
  projectId: string;
  filename: string;
  fileType: "pdf" | "docx" | "txt" | "url";
  status: DocumentStatus;
  uploadedAt: Date;
  errorMessage?: string;
}

/**
 * Document status type
 */
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

/**
 * File size limits by type (in bytes)
 */
const FILE_SIZE_LIMITS = {
  pdf: 10 * 1024 * 1024, // 10MB
  docx: 10 * 1024 * 1024, // 10MB
  txt: 5 * 1024 * 1024, // 5MB
};

/**
 * Supported file types
 */
const SUPPORTED_FILE_TYPES = ["pdf", "docx", "txt"];

/**
 * Service class for document management operations
 */
export class DocumentService {
  private textExtractor: TextExtractor;
  private textChunker: TextChunker;
  private chromaClient: ChromaClient;

  constructor() {
    this.textExtractor = new TextExtractor();
    this.textChunker = new TextChunker();

    // Initialize ChromaDB client for vector store operations
    const config = getConfig();
    this.chromaClient = new ChromaClient({
      path: `http://${config.vectorStore.host}:${config.vectorStore.port}`,
    });
  }

  /**
   * Validates file size based on file type
   * Requirements: 2.1, 2.2, 2.3, 2.5
   *
   * @param fileType - The type of file (pdf, docx, txt)
   * @param fileSize - The size of the file in bytes
   * @throws ValidationError if file size exceeds limit
   */
  private validateFileSize(fileType: string, fileSize: number): void {
    const limit = FILE_SIZE_LIMITS[fileType as keyof typeof FILE_SIZE_LIMITS];

    if (!limit) {
      throw new ValidationError(`Unsupported file type: ${fileType}`);
    }

    if (fileSize > limit) {
      const limitMB = limit / (1024 * 1024);
      throw new ValidationError(
        `File size exceeds ${limitMB}MB limit for ${fileType.toUpperCase()} files`
      );
    }
  }

  /**
   * Validates file type
   * Requirements: 2.6
   *
   * @param fileType - The type of file
   * @throws ValidationError if file type is not supported
   */
  private validateFileType(fileType: string): void {
    if (!SUPPORTED_FILE_TYPES.includes(fileType.toLowerCase())) {
      throw new ValidationError(
        `Unsupported file type: ${fileType}. Supported types: ${SUPPORTED_FILE_TYPES.join(
          ", "
        )}`
      );
    }
  }

  /**
   * Validates URL format
   * Requirements: 2.4
   *
   * @param url - The URL to validate
   * @throws ValidationError if URL format is invalid
   */
  private validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new ValidationError("URL must use HTTP or HTTPS protocol");
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid URL format: ${url}`);
    }
  }

  /**
   * Uploads a document file and creates a database record
   * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 12.3
   *
   * @param projectId - The project ID to associate the document with
   * @param file - The file to upload (with name, type, and buffer)
   * @returns Promise<Document> - The created document with status "pending"
   * @throws ValidationError if file validation fails
   * @throws NotFoundError if project doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async uploadDocument(
    projectId: string,
    file: { name: string; type: string; buffer: Buffer }
  ): Promise<Document> {
    try {
      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundError(`Project with id ${projectId} not found`);
      }

      // Extract file type from filename or MIME type
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
      const fileType =
        fileExtension || file.type.split("/").pop()?.toLowerCase() || "";

      // Validate file type
      this.validateFileType(fileType);

      // Validate file size
      this.validateFileSize(fileType, file.buffer.length);

      // Create database record with status "pending"
      // Requirement 12.3: Initial status is "pending"
      const document = await prisma.document.create({
        data: {
          projectId,
          filename: file.name,
          fileType,
          status: "pending",
        },
      });

      return {
        id: document.id,
        projectId: document.projectId,
        filename: document.filename,
        fileType: document.fileType as "pdf" | "docx" | "txt" | "url",
        status: document.status as DocumentStatus,
        uploadedAt: document.uploadedAt,
        errorMessage: document.errorMessage || undefined,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to upload document: ${(error as Error).message}`
      );
    }
  }

  /**
   * Uploads a URL and creates a database record
   * Requirements: 2.4, 12.3
   *
   * @param projectId - The project ID to associate the document with
   * @param url - The URL to upload
   * @returns Promise<Document> - The created document with status "pending"
   * @throws ValidationError if URL validation fails
   * @throws NotFoundError if project doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async uploadUrl(projectId: string, url: string): Promise<Document> {
    try {
      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new NotFoundError(`Project with id ${projectId} not found`);
      }

      // Validate URL format
      this.validateUrl(url);

      // Create database record with status "pending"
      // Requirement 12.3: Initial status is "pending"
      const document = await prisma.document.create({
        data: {
          projectId,
          filename: url, // Store URL in filename field
          fileType: "url",
          status: "pending",
        },
      });

      return {
        id: document.id,
        projectId: document.projectId,
        filename: document.filename,
        fileType: document.fileType as "pdf" | "docx" | "txt" | "url",
        status: document.status as DocumentStatus,
        uploadedAt: document.uploadedAt,
        errorMessage: document.errorMessage || undefined,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        `Failed to upload URL: ${(error as Error).message}`
      );
    }
  }

  /**
   * Processes a document through the complete RAG pipeline
   * Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 12.4, 12.5
   *
   * Pipeline steps:
   * 1. Extract text using TextExtractor
   * 2. Chunk text using TextChunker
   * 3. Generate embeddings using Google Generative AI
   * 4. Store vectors in ChromaDB
   * 5. Update document status to "ready" or "failed"
   *
   * @param documentId - The document ID to process
   * @param fileBuffer - Optional file buffer (required for file documents, not for URLs)
   * @returns Promise<void>
   * @throws NotFoundError if document doesn't exist
   */
  async processDocument(
    documentId: string,
    fileBuffer?: Buffer
  ): Promise<void> {
    try {
      // Retrieve document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        throw new NotFoundError(`Document with id ${documentId} not found`);
      }

      // Update status to "processing"
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "processing" },
      });

      // Step 1: Extract text based on file type
      // Requirements: 3.1, 3.2, 3.3, 3.4
      let extractedText: string;

      try {
        if (document.fileType === "url") {
          // Extract from URL (filename field contains the URL)
          extractedText = await this.textExtractor.extractFromUrl(
            document.filename
          );
        } else {
          // Extract from file buffer
          if (!fileBuffer) {
            throw new ValidationError(
              "File buffer is required for file documents"
            );
          }

          switch (document.fileType) {
            case "pdf":
              extractedText = await this.textExtractor.extractFromPdf(
                fileBuffer
              );
              break;
            case "docx":
              extractedText = await this.textExtractor.extractFromDocx(
                fileBuffer
              );
              break;
            case "txt":
              extractedText = await this.textExtractor.extractFromTxt(
                fileBuffer
              );
              break;
            default:
              throw new ValidationError(
                `Unsupported file type: ${document.fileType}`
              );
          }
        }
      } catch (error) {
        // Requirement 3.5: Mark document as failed if extraction fails
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "failed",
            errorMessage: `Text extraction failed: ${(error as Error).message}`,
          },
        });
        throw error;
      }

      // Step 2: Chunk text
      // Requirements: 4.1, 4.2, 4.3, 4.4
      const chunks = await this.textChunker.chunkText(extractedText, {
        documentId: document.id,
        filename: document.filename,
      });

      if (chunks.length === 0) {
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "failed",
            errorMessage: "No text chunks generated from document",
          },
        });
        return;
      }

      // Step 3: Generate embeddings
      // Requirement 5.1: Generate embeddings for each chunk
      const config = getConfig();
      const embeddingModel = new GoogleGenerativeAIEmbeddings({
        apiKey: config.embedding.apiKey,
        modelName: config.embedding.modelName,
      });

      let embeddings: number[][];
      try {
        const chunkTexts = chunks.map((chunk) => chunk.text);
        embeddings = await embeddingModel.embedDocuments(chunkTexts);
      } catch (error) {
        // Requirement 5.5: Mark document as failed if embedding fails
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "failed",
            errorMessage: `Embedding generation failed: ${
              (error as Error).message
            }`,
          },
        });
        throw error;
      }

      // Step 4: Store vectors in ChromaDB
      // Requirements: 5.2, 5.3
      try {
        const collectionName = `project_${document.projectId}`;

        // Get or create collection for this project
        // Requirement 5.3: Store in project-specific collection
        let collection;
        try {
          collection = await this.chromaClient.getCollection({
            name: collectionName,
          });
        } catch (error) {
          // Collection doesn't exist, create it
          collection = await this.chromaClient.createCollection({
            name: collectionName,
          });
        }

        // Add documents to collection
        // Requirement 5.2: Store embedding vector with chunk text
        await collection.add({
          ids: chunks.map((chunk, i) => `${documentId}_${i}`),
          embeddings: embeddings,
          documents: chunks.map((chunk) => chunk.text),
          metadatas: chunks.map((chunk) => chunk.metadata),
        });
      } catch (error) {
        // Mark document as failed if vector storage fails
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "failed",
            errorMessage: `Vector storage failed: ${(error as Error).message}`,
          },
        });
        throw new VectorStoreError(
          `Failed to store vectors: ${(error as Error).message}`
        );
      }

      // Step 5: Update document status to "ready"
      // Requirement 5.4, 12.4: Update status to ready when successful
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "ready" },
      });
    } catch (error) {
      // If error wasn't already handled (status not updated to failed), handle it here
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (document && document.status !== "failed") {
        // Requirement 12.5: Update status to failed on error
        await prisma.document.update({
          where: { id: documentId },
          data: {
            status: "failed",
            errorMessage: `Processing failed: ${(error as Error).message}`,
          },
        });
      }

      throw error;
    }
  }
}
