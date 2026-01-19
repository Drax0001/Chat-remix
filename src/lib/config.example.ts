/**
 * Example usage of the configuration module
 *
 * This file demonstrates how to use the configuration loader
 * in different parts of the application.
 */

import { getConfig } from "./config";

// Example 1: Using configuration in a service
export function exampleDatabaseConnection() {
  const config = getConfig();
  console.log("Connecting to database:", config.database.url);
  // Use config.database.url to connect to PostgreSQL
}

// Example 2: Using LLM configuration
export function exampleLLMSetup() {
  const config = getConfig();

  if (config.llm.provider === "gemini") {
    console.log("Using Google Gemini with API key");
    console.log("Model:", config.llm.modelName);
    console.log("Temperature:", config.llm.temperature);
    // Initialize Gemini with config.llm.apiKey
  } else {
    console.log("Using local LLM at:", config.llm.endpoint);
    // Initialize local LLM with config.llm.endpoint
  }
}

// Example 3: Using embedding configuration
export function exampleEmbeddingSetup() {
  const config = getConfig();

  console.log("Embedding provider:", config.embedding.provider);
  console.log("Embedding dimensions:", config.embedding.dimensions);

  if (config.embedding.provider === "gemini") {
    // Initialize Google Gemini embeddings
  } else {
    // Initialize local embeddings
  }
}

// Example 4: Using vector store configuration
export function exampleVectorStoreConnection() {
  const config = getConfig();

  const chromaUrl = `http://${config.vectorStore.host}:${config.vectorStore.port}`;
  console.log("Connecting to ChromaDB at:", chromaUrl);
  // Initialize ChromaDB client
}

// Example 5: Using processing configuration
export function exampleFileValidation(fileSizeInBytes: number) {
  const config = getConfig();

  const maxSizeInBytes = config.processing.maxFileSizeMB * 1024 * 1024;

  if (fileSizeInBytes > maxSizeInBytes) {
    throw new Error(
      `File size exceeds maximum of ${config.processing.maxFileSizeMB}MB`
    );
  }

  console.log("File size is valid");
}

// Example 6: Using relevance threshold
export function exampleRelevanceCheck(similarityScore: number) {
  const config = getConfig();

  if (similarityScore >= config.processing.relevanceThreshold) {
    console.log("Score meets threshold, proceeding with LLM invocation");
    return true;
  } else {
    console.log("Score below threshold, returning 'I don't know'");
    return false;
  }
}

// Example 7: Using chunking configuration
export function exampleChunkingSetup() {
  const config = getConfig();

  console.log("Chunk size:", config.processing.chunkSize);
  console.log("Chunk overlap:", config.processing.chunkOverlap);

  // Use these values to configure RecursiveCharacterTextSplitter
}
