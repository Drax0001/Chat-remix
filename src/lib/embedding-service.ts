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
import { LLMError, QuotaExceededError, TimeoutError, ServiceUnavailableError } from "./errors";
import { CircuitBreaker, withRetryAndCircuitBreaker } from "./retry";

// For local embedding endpoints
interface LocalEmbeddingRequest {
  texts: string[];
}

interface LocalEmbeddingResponse {
  embeddings: number[][];
}

/**
 * EmbeddingService class
 * Handles embedding generation for document chunks and user queries
 */
export class EmbeddingService {
  private model: GoogleGenerativeAIEmbeddings | null = null;
  private config = getConfig();
  private circuitBreaker: CircuitBreaker;
  private isLocalProvider: boolean = false;

  constructor() {
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Initializes the embedding model based on configuration
   * @private
   */
  private initializeModel(): GoogleGenerativeAIEmbeddings | null {
    const { embedding } = this.config;

    if (embedding.provider === "gemini") {
      if (this.model) {
        return this.model;
      }

      if (!embedding.apiKey) {
        throw new LLMError(
          "Google API key is required for Gemini embedding provider"
        );
      }

      this.model = new GoogleGenerativeAIEmbeddings({
        apiKey: embedding.apiKey,
        model: embedding.modelName,
      });
      this.isLocalProvider = false;
      return this.model;
    } else if (embedding.provider === "local") {
      // For local embedding endpoints, we use HTTP client
      this.isLocalProvider = true;
      return null;
    } else {
      throw new LLMError(
        `Unsupported embedding provider: ${embedding.provider}`
      );
    }
  }

  /**
   * Calls a local embedding endpoint via HTTP
   * @private
   */
  private async callLocalEmbedding(text: string): Promise<number[]> {
    const { embedding } = this.config;

    if (!embedding.endpoint) {
      throw new LLMError("Local embedding endpoint is required for local provider");
    }

    const request: LocalEmbeddingRequest = {
      texts: [text],
    };

    try {
      const response = await fetch(embedding.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new LLMError(`Local embedding request failed: ${response.status} ${response.statusText}`);
      }

      const data: LocalEmbeddingResponse = await response.json();

      if (!data.embeddings || data.embeddings.length === 0 || data.embeddings[0].length === 0) {
        throw new LLMError("Invalid response from local embedding endpoint");
      }

      return data.embeddings[0];
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(`Failed to call local embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calls a local embedding endpoint for batch processing
   * @private
   */
  private async callLocalBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const { embedding } = this.config;

    if (!embedding.endpoint) {
      throw new LLMError("Local embedding endpoint is required for local provider");
    }

    const request: LocalEmbeddingRequest = {
      texts,
    };

    try {
      const response = await fetch(embedding.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new LLMError(`Local embedding batch request failed: ${response.status} ${response.statusText}`);
      }

      const data: LocalEmbeddingResponse = await response.json();

      if (!data.embeddings || data.embeddings.length !== texts.length) {
        throw new LLMError("Invalid response from local embedding endpoint");
      }

      return data.embeddings;
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(`Failed to call local embedding batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      const embedding = await withRetryAndCircuitBreaker(
        async () => {
          // Initialize model (or check provider type)
          this.initializeModel();

          if (this.isLocalProvider) {
            // Use local embedding endpoint
            return await this.callLocalEmbedding(text);
          } else {
            // Use Gemini
            const model = this.model!;
            return await model.embedQuery(text);
          }
        },
        this.circuitBreaker
      );

      return embedding;
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("Circuit breaker is OPEN")) {
        throw new ServiceUnavailableError("Embedding service temporarily unavailable");
      }

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
      const embeddings = await withRetryAndCircuitBreaker(
        async () => {
          // Initialize model (or check provider type)
          this.initializeModel();

          if (this.isLocalProvider) {
            // Use local embedding endpoint
            return await this.callLocalBatchEmbeddings(texts);
          } else {
            // Use Gemini
            const model = this.model!;
            return await model.embedDocuments(texts);
          }
        },
        this.circuitBreaker
      );

      return embeddings;
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("Circuit breaker is OPEN")) {
        throw new ServiceUnavailableError("Embedding service temporarily unavailable");
      }

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
