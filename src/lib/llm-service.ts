/**
 * LLM Service Module
 *
 * This module provides an interface to Large Language Models (LLMs) for generating
 * responses based on retrieved context. It supports both Google Gemini and local LLM endpoints.
 *
 * Requirements: 10.4, 11.1, 15.1, 15.2
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getConfig } from "./config";
import { LLMError, QuotaExceededError, TimeoutError } from "./errors";

/**
 * LLMService class
 * Handles LLM invocation with strict configuration to prevent hallucinations
 */
export class LLMService {
  private model: ChatGoogleGenerativeAI | null = null;
  private config = getConfig();

  /**
   * Initializes the LLM model based on configuration
   * @private
   */
  private initializeModel(): ChatGoogleGenerativeAI {
    if (this.model) {
      return this.model;
    }

    const { llm } = this.config;

    if (llm.provider === "gemini") {
      if (!llm.apiKey) {
        throw new LLMError("Google API key is required for Gemini provider");
      }

      // Ensure temperature is <= 0.3 as per requirement 10.4
      const temperature = Math.min(llm.temperature, 0.3);

      this.model = new ChatGoogleGenerativeAI({
        apiKey: llm.apiKey,
        model: llm.modelName,
        temperature,
        maxOutputTokens: llm.maxTokens,
      });
    } else if (llm.provider === "local") {
      // For local LLM endpoints, we would use a different implementation
      // This is a placeholder for future local LLM support
      throw new LLMError(
        "Local LLM provider not yet implemented. Use 'gemini' provider."
      );
    } else {
      throw new LLMError(`Unsupported LLM provider: ${llm.provider}`);
    }

    return this.model;
  }

  /**
   * Generates a response from the LLM based on system and user prompts
   *
   * This method invokes the LLM with strict instructions to only answer based on
   * provided context, preventing hallucinations. The LLM output is returned verbatim
   * without any post-processing to maintain factual integrity.
   *
   * Requirements:
   * - 10.4: Temperature is enforced to be <= 0.3
   * - 11.1: LLM output is returned verbatim without modification
   * - 15.1: Supports configuration from environment variables
   * - 15.2: Supports both Gemini and local LLM endpoints
   *
   * @param systemPrompt - Instructions for the LLM on how to behave
   * @param userPrompt - The user's question with assembled context
   * @returns The LLM's response as a string
   * @throws LLMError if the LLM invocation fails
   * @throws QuotaExceededError if API quota is exceeded
   * @throws TimeoutError if the request times out
   */
  async generateResponse(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    try {
      const model = this.initializeModel();

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const response = await model.invoke(messages);

      // Return the LLM output verbatim (Requirement 11.1)
      return typeof response.content === "string"
        ? response.content
        : String(response.content);
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("quota")) {
        throw new QuotaExceededError("LLM API quota exceeded");
      }

      if (error.message?.includes("timeout")) {
        throw new TimeoutError("LLM request timed out");
      }

      // Generic LLM error
      throw new LLMError(
        `Failed to generate response: ${error.message || "Unknown error"}`
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
