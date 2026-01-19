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
import { LLMError, QuotaExceededError, TimeoutError, ServiceUnavailableError } from "./errors";
import { CircuitBreaker, withRetryAndCircuitBreaker } from "./retry";

// For local LLM endpoints
interface LocalLLMRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

interface LocalLLMResponse {
  choices: Array<{ message: { content: string } }>;
}

/**
 * Calls a local LLM endpoint via HTTP
 * @private
 */
private async callLocalLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const { llm } = this.config;

  if (!llm.endpoint) {
    throw new LLMError("Local LLM endpoint is required for local provider");
  }

  const request: LocalLLMRequest = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: Math.min(llm.temperature, 0.3),
    max_tokens: llm.maxTokens,
  };

  try {
    const response = await fetch(llm.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new LLMError(`Local LLM request failed: ${response.status} ${response.statusText}`);
    }

    const data: LocalLLMResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new LLMError("Invalid response from local LLM");
    }

    return data.choices[0].message.content;
  } catch (error) {
    if (error instanceof LLMError) {
      throw error;
    }
    throw new LLMError(`Failed to call local LLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * LLMService class
 * Handles LLM invocation with strict configuration to prevent hallucinations
 */
export class LLMService {
  private model: ChatGoogleGenerativeAI | null = null;
  private config = getConfig();
  private circuitBreaker: CircuitBreaker;
  private isLocalProvider: boolean = false;

  constructor() {
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Initializes the LLM model based on configuration
   * @private
   */
  private initializeModel(): ChatGoogleGenerativeAI | null {
    const { llm } = this.config;

    if (llm.provider === "gemini") {
      if (this.model) {
        return this.model;
      }

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
      this.isLocalProvider = false;
      return this.model;
    } else if (llm.provider === "local") {
      // For local LLM endpoints, we use HTTP client
      this.isLocalProvider = true;
      return null;
    } else {
      throw new LLMError(`Unsupported LLM provider: ${llm.provider}`);
    }
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
      const response = await withRetryAndCircuitBreaker(
        async () => {
          // Initialize model (or check provider type)
          this.initializeModel();

          if (this.isLocalProvider) {
            // Use local LLM endpoint
            return await this.callLocalLLM(systemPrompt, userPrompt);
          } else {
            // Use Gemini
            const model = this.model!;
            const messages = [
              new SystemMessage(systemPrompt),
              new HumanMessage(userPrompt),
            ];

            const result = await model.invoke(messages);

            // Return the LLM output verbatim (Requirement 11.1)
            return typeof result.content === "string"
              ? result.content
              : String(result.content);
          }
        },
        this.circuitBreaker
      );

      return response;
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes("Circuit breaker is OPEN")) {
        throw new ServiceUnavailableError("LLM service temporarily unavailable");
      }

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
