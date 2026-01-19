/**
 * Embedding Service Module
 *
 * This module provides an interface to embedding models for generating vector
 * representations of text. It supports both Google Gemini and local embedding endpoints.
 *
 * Requirements: 5.1, 6.2, 15.3
 */

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { getConfig } from "./config";
import { LLMError, QuotaExceededError, TimeoutError } from "./errors";

/**
 * EmbeddingService class
 * Handles embedding generation for document chunks and user queries
 */
export class EmbeddingService {
  private model: GoogleGenerativeAIEmbeddings | null = null;
  private config = getConfig();

  /**
   * Initializes the embedding model based on configuration
   * @private
   */
  private initializeModel(): GoogleGenerativeAIEmbeddings {
    if (this.model) {
      return this.model;
    }

    const { embedding } = this.config;

    if (embedding.provider === "gemini") {
      if (!embedding.apiKey) {
        throw new LLMError(
          "Google API key is required for Gemini embedding provider"
        );
      }

      this.model = new GoogleGenerativeAIEmbeddings({
        apiKey: embedding.apiKey,
        model: embedding.modelName,
      });
    } else if (embedding.provider === "local") {
      // For local embedding endpoints, we would use a different implementation
      // This is a placeholder for future local embedding support
      throw new LLMError(
        "Local embedding provider not yet implemented. Use 'gemini' provider."
      );
    } else {
      throw new LLMError(
        `Unsupported embedding provider: ${embedding.provider}`
      );
    }

    return this.model;
  }

  /**
   * Generates an embedding vector for a single text string
   *
   * This method is used for generating query embeddings during the chat flow.
   * The embedding dimensions are determined by the configured model.
   *
   * Requirements:
   * - 5.1: Generates embeddings for document chunks
   * - 6.2: Generates embeddings for user queries using the same model
   * - 15.3: Supports configuration from environment variables
   *
   * @param text - The text to generate an embedding for
   * @returns A promise that resolves to a number array representing the embedding vector
   * @throws LLMError if embedding generation fails
   * @throws QuotaExceededError if API quota is exceeded
   * @throws TimeoutError if the request times out
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.initializeModel();
      const embedding = await model.embedQuery(text);
      return embedding;
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("quota")) {
        throw new QuotaExceededError("Embedding API quota exceeded");
      }

      if (error.message?.includes("timeout")) {
        throw new TimeoutError("Embedding request timed out");
      }

      // Generic embedding error
      throw new LLMError(
        `Failed to generate embedding: ${error.message || "Unknown error"}`
      );
    }
  }

  /**
   * Generates embedding vectors for multiple text strings in batch
   *
   * This method is used for generating embeddings for document chunks during
   * the document processing pipeline. Batch processing is more efficient than
   * generating embeddings one at a time.
   *
   * Requirements:
   * - 5.1: Generates embeddings for all document chunks
   * - 15.3: Supports configuration from environment variables
   *
   * @param texts - An array of text strings to generate embeddings for
   * @returns A promise that resolves to a 2D array where each inner array is an embedding vector
   * @throws LLMError if embedding generation fails
   * @throws QuotaExceededError if API quota is exceeded
   * @throws TimeoutError if the request times out
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const model = this.initializeModel();
      const embeddings = await model.embedDocuments(texts);
      return embeddings;
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("quota")) {
        throw new QuotaExceededError("Embedding API quota exceeded");
      }

      if (error.message?.includes("timeout")) {
        throw new TimeoutError("Embedding request timed out");
      }

      // Generic embedding error
      throw new LLMError(
        `Failed to generate batch embeddings: ${
          error.message || "Unknown error"
        }`
      );
    }
  }

  /**
   * Resets the model instance
   * Useful for testing or when configuration changes
   */
  resetModel(): void {
    this.model = null;
  }
}
