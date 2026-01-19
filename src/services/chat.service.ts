/**
 * ChatService - Handles user queries and orchestrates RAG pipeline
 * Processes queries by validating projects, generating embeddings, searching vectors,
 * assembling context, and invoking LLM with strict knowledge restrictions
 * Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3
 */

import { ProjectService } from "./project.service";
import { EmbeddingService } from "../lib/embedding-service";
import { VectorStore } from "../lib/vector-store";
import { LLMService } from "../lib/llm-service";
import {
  NotFoundError,
  ValidationError,
  ServiceUnavailableError,
} from "../lib/errors";
import { getConfig } from "../lib/config";

/**
 * Chat query request interface
 */
export interface ChatRequest {
  projectId: string;
  message: string;
}

/**
 * Chat response interface
 */
export interface ChatResponse {
  answer: string;
  sourceCount: number;
}

/**
 * Service class for processing chat queries using RAG pipeline
 */
export class ChatService {
  private projectService: ProjectService;
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  private llmService: LLMService;
  private config = getConfig();

  constructor() {
    this.projectService = new ProjectService();
    this.embeddingService = new EmbeddingService();
    this.vectorStore = new VectorStore();
    this.llmService = new LLMService();
  }

  /**
   * Processes a user query through the complete RAG pipeline
   *
   * This method orchestrates the entire query processing flow:
   * 1. Validates project existence
   * 2. Generates query embedding
   * 3. Performs similarity search
   * 4. Checks relevance threshold
   * 5. Assembles context if relevant
   * 6. Constructs prompts with strict instructions
   * 7. Invokes LLM
   * 8. Returns response with source count
   *
   * Requirements:
   * - 6.1: Validate project exists
   * - 6.2: Generate embedding for user message
   * - 6.3: Return error for invalid project
   * - 7.1: Similarity search filtered by project
   * - 7.2: Top 5 similar chunks
   * - 7.3: Return text and similarity score
   * - 7.4: Rank by similarity score
   * - 8.1: Identify highest similarity score
   * - 8.2: Check relevance threshold (0.75)
   * - 8.3: Assemble context if threshold met
   * - 8.4: Don't invoke LLM if threshold not met
   * - 9.1: Concatenate chunks in ranked order
   * - 9.2: Respect token limits
   * - 9.3: Truncate preserving ranking
   * - 10.1: System prompt with knowledge restriction
   * - 10.2: Exact fallback instruction "I don't know"
   * - 10.3: User prompt with context and question
   * - 10.4: Temperature ≤ 0.3
   * - 11.1: Return LLM output verbatim
   * - 11.2: Include source chunk count
   * - 11.3: Consistent JSON response format
   *
   * @param request - The chat request containing projectId and message
   * @returns Promise<ChatResponse> - The response with answer and source count
   * @throws NotFoundError if project does not exist
   * @throws ValidationError if request is invalid
   * @throws ServiceUnavailableError if external services are unavailable
   */
  async processQuery(request: ChatRequest): Promise<ChatResponse> {
    const { projectId, message } = request;

    // Validate request
    if (!projectId || !projectId.trim()) {
      throw new ValidationError("Project ID is required");
    }

    if (!message || !message.trim()) {
      throw new ValidationError("Message is required");
    }

    // 6.1: Validate that the project exists
    try {
      await this.projectService.getProject(projectId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Project '${projectId}' not found`);
      }
      throw error;
    }

    // 6.2: Generate embedding for the user message
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingService.generateEmbedding(message);
    } catch (error) {
      throw new ServiceUnavailableError("Unable to process query embedding");
    }

    // 7.1, 7.2, 7.3, 7.4: Perform similarity search
    let searchResults;
    try {
      searchResults = await this.vectorStore.similaritySearch(
        projectId,
        queryEmbedding,
        5 // Top 5 similar chunks
      );
    } catch (error) {
      throw new ServiceUnavailableError("Unable to perform similarity search");
    }

    // 8.1, 8.2: Check relevance threshold
    const highestScore = searchResults.length > 0 ? searchResults[0].score : 0;
    const relevanceThreshold = this.config.processing.relevanceThreshold; // 0.75

    if (highestScore < relevanceThreshold) {
      // 8.4: Don't invoke LLM if threshold not met
      return {
        answer: "I don't know",
        sourceCount: 0,
      };
    }

    // 8.3: Assemble context if threshold met
    const context = this.assembleContext(searchResults);

    // 10.1, 10.2, 10.3: Construct prompts
    const systemPrompt = `You are a helpful assistant that answers questions based ONLY on the provided context.
If the answer is not explicitly present in the context, respond exactly: "I don't know"
Do not make assumptions or provide information not contained in the context.`;

    const userPrompt = `Context:
${context}

Question: ${message}

Answer the question based only on the context provided above.`;

    // 10.4: Invoke LLM (temperature already constrained in LLMService)
    let llmResponse: string;
    try {
      llmResponse = await this.llmService.generateResponse(
        systemPrompt,
        userPrompt
      );
    } catch (error) {
      throw new ServiceUnavailableError("Unable to generate response");
    }

    // 11.1, 11.2, 11.3: Return response verbatim with source count
    return {
      answer: llmResponse,
      sourceCount: searchResults.length,
    };
  }

  /**
   * Assembles context from search results with token limit consideration
   *
   * Requirements:
   * - 9.1: Concatenate in ranked order
   * - 9.2: Respect token limits
   * - 9.3: Truncate preserving ranking
   *
   * @param searchResults - The ranked search results
   * @returns The assembled context string
   * @private
   */
  private assembleContext(
    searchResults: Array<{ text: string; score: number }>
  ): string {
    // Simple token estimation: ~4 characters per token
    const maxContextTokens = 3000; // Conservative limit to leave room for prompts
    const maxContextChars = maxContextTokens * 4;

    let context = "";
    let includedChunks = 0;

    // 9.1: Concatenate in ranked order (results are already sorted by score)
    for (const result of searchResults) {
      const chunkText = result.text.trim();
      if (!chunkText) continue;

      const newContext = context ? `${context}\n\n${chunkText}` : chunkText;

      // 9.2: Check if adding this chunk would exceed limits
      if (newContext.length > maxContextChars) {
        break; // 9.3: Truncate preserving ranking
      }

      context = newContext;
      includedChunks++;
    }

    return context || "No relevant context found.";
  }
}
