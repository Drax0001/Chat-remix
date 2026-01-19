/**
 * Example usage of LLMService
 *
 * This file demonstrates how to use the LLMService class to generate
 * responses from the LLM with strict anti-hallucination measures.
 */

import { LLMService } from "./llm-service";

async function exampleUsage() {
  const llmService = new LLMService();

  // Example 1: Basic usage with context
  const systemPrompt = `You are a factual assistant. Answer ONLY using the provided context. If the answer is not explicitly present, respond exactly: "I don't know."`;

  const context = `
The company was founded in 2020.
The headquarters is located in San Francisco.
The company has 50 employees.
`;

  const userPrompt = `Context:
${context}

Question: When was the company founded?`;

  try {
    const response = await llmService.generateResponse(
      systemPrompt,
      userPrompt
    );
    console.log("Response:", response);
    // Expected: "The company was founded in 2020."
  } catch (error) {
    console.error("Error:", error);
  }

  // Example 2: Question not in context
  const userPrompt2 = `Context:
${context}

Question: What is the company's revenue?`;

  try {
    const response2 = await llmService.generateResponse(
      systemPrompt,
      userPrompt2
    );
    console.log("Response:", response2);
    // Expected: "I don't know"
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
if (require.main === module) {
  exampleUsage();
}
