/**
 * Vector Store Service Module
 *
 * This module provides an interface to ChromaDB for storing and retrieving
 * document embeddings. It supports project-level isolation and semantic similarity search.
 *
 * Requirements: 5.2, 5.3, 7.1, 7.2
 */

import { ChromaClient, Collection } from "chromadb";
import { getConfig } from "./config";
import { VectorStoreError, ServiceUnavailableError } from "./errors";
import { CircuitBreaker, withRetryAndCircuitBreaker } from "./retry";

/**
 * Document chunk with metadata for storage
 */
export interface DocumentChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * VectorStore class
 * Handles vector storage and retrieval operations with ChromaDB
 */
export class VectorStore {
  private client: ChromaClient;
  private config = getConfig();
  private circuitBreaker: CircuitBreaker;

  /**
   * Initializes the ChromaDB client and circuit breaker
   */
  constructor() {
    this.client = new ChromaClient({
      path: `http://${this.config.vectorStore.host}:${this.config.vectorStore.port}`,
    });
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Creates a project-specific collection in ChromaDB
   *
   * Collections provide isolation between projects, ensuring that queries
   * for one project never return data from another project.
   *
   * Requirements:
   * - 5.3: Store embeddings in project-specific collections
   *
   * @param projectId - The unique project identifier
   * @returns Promise that resolves when collection is created
   * @throws VectorStoreError if collection creation fails
   */
  async createCollection(projectId: string): Promise<void> {
    try {
      await withRetryAndCircuitBreaker(
        async () => {
          // Check if collection already exists
          const collections = await this.client.listCollections();
          const collectionExists = collections.some(
            (collection) => collection.name === projectId
          );

          if (!collectionExists) {
            await this.client.createCollection({
              name: projectId,
              metadata: {
                createdAt: new Date().toISOString(),
                projectId: projectId,
              },
            });
          }
        },
        this.circuitBreaker
      );
    } catch (error: any) {
      if (
        error.message?.includes("Circuit breaker is OPEN") ||
        error.message?.includes("connection") ||
        error.message?.includes("unreachable")
      ) {
        throw new ServiceUnavailableError(
          `Vector store connection failed: ${error.message}`
        );
      }

      throw new VectorStoreError(
        `Failed to create collection for project ${projectId}: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Adds document chunks with embeddings to a project collection
   *
   * This method stores all chunks from a document along with their embeddings.
   * The chunks are stored in the project-specific collection to maintain isolation.
   *
   * Requirements:
   * - 5.2: Store each embedding vector with its associated chunk text
   *
   * @param projectId - The project identifier
   * @param chunks - Array of document chunks with embeddings
   * @returns Promise that resolves when documents are added
   * @throws VectorStoreError if document addition fails
   */
  async addDocuments(projectId: string, chunks: DocumentChunk[]): Promise<void> {
    try {
      await withRetryAndCircuitBreaker(
        async () => {
          const collection = await this.client.getCollection({
            name: projectId,
          });

          // Prepare data for batch insertion
          const ids = chunks.map((chunk) => chunk.id);
          const embeddings = chunks.map((chunk) => chunk.embedding);
          const metadatas = chunks.map((chunk) => ({
            text: chunk.text,
            ...chunk.metadata,
          }));
          const documents = chunks.map((chunk) => chunk.text);

          await collection.add({
            ids,
            embeddings,
            metadatas,
            documents,
          });
        },
        this.circuitBreaker
      );
    } catch (error: any) {
      if (
        error.message?.includes("Circuit breaker is OPEN") ||
        error.message?.includes("connection") ||
        error.message?.includes("unreachable")
      ) {
        throw new ServiceUnavailableError(
          `Vector store connection failed: ${error.message}`
        );
      }

      throw new VectorStoreError(
        `Failed to add documents to project ${projectId}: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Performs similarity search within a project collection
   *
   * This method retrieves the most relevant document chunks based on cosine similarity
   * to the query embedding. Results are filtered by project and limited to top-K.
   *
   * Requirements:
   * - 7.1: Perform similarity search filtered by project collection
   * - 7.2: Retrieve top 5 most similar chunks based on cosine similarity
   *
   * @param projectId - The project identifier
   * @param queryEmbedding - The embedding vector for the query
   * @param topK - Maximum number of results to return (default: 5)
   * @returns Promise that resolves to array of search results with similarity scores
   * @throws VectorStoreError if search fails
   */
  async similaritySearch(
    projectId: string,
    queryEmbedding: number[],
    topK: number = 5
  ): Promise<SearchResult[]> {
    try {
      const results = await withRetryAndCircuitBreaker(
        async () => {
          const collection = await this.client.getCollection({
            name: projectId,
          });

          return await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
            include: ["documents", "metadatas", "distances"],
          });
        },
        this.circuitBreaker
      );

      // Transform results into SearchResult format
      const searchResults: SearchResult[] = [];

      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const id = results.ids[0][i];
          const text = results.documents?.[0]?.[i] || "";
          const score = 1 - (results.distances?.[0]?.[i] || 0); // Convert distance to similarity
          const metadata = results.metadatas?.[0]?.[i] || {};

          searchResults.push({
            id,
            text,
            score,
            metadata,
          });
        }
      }

      // Sort by score in descending order (highest similarity first)
      return searchResults.sort((a, b) => b.score - a.score);
    } catch (error: any) {
      if (
        error.message?.includes("Circuit breaker is OPEN") ||
        error.message?.includes("connection") ||
        error.message?.includes("unreachable")
      ) {
        throw new ServiceUnavailableError(
          `Vector store connection failed: ${error.message}`
        );
      }

      throw new VectorStoreError(
        `Failed to perform similarity search for project ${projectId}: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Deletes a project collection and all its data
   *
   * This method removes the entire collection for a project, including all
   * document chunks and embeddings. This is called during project deletion.
   *
   * Requirements:
   * - 1.3: Remove all associated documents from Vector_Database during project deletion
   *
   * @param projectId - The project identifier
   * @returns Promise that resolves when collection is deleted
   * @throws VectorStoreError if deletion fails
   */
  async deleteCollection(projectId: string): Promise<void> {
    try {
      await this.client.deleteCollection({
        name: projectId,
      });
    } catch (error: any) {
      if (
        error.message?.includes("connection") ||
        error.message?.includes("unreachable")
      ) {
        throw new ServiceUnavailableError(
          `Vector store connection failed: ${error.message}`
        );
      }

      // Collection might not exist, which is not an error for deletion
      if (error.message?.includes("not found")) {
        return;
      }

      throw new VectorStoreError(
        `Failed to delete collection for project ${projectId}: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Checks if a collection exists for a project
   *
   * @param projectId - The project identifier
   * @returns Promise that resolves to true if collection exists
   */
  async collectionExists(projectId: string): Promise<boolean> {
    try {
      const collections = await this.client.listCollections();
      return collections.some((collection) => collection.name === projectId);
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Gets the number of documents in a project collection
   *
   * @param projectId - The project identifier
   * @returns Promise that resolves to document count
   */
  async getDocumentCount(projectId: string): Promise<number> {
    try {
      const collection = await this.client.getCollection({
        name: projectId,
      });
      const count = await collection.count();
      return count;
    } catch (error: any) {
      return 0;
    }
  }
}