/**
 * Manual verification script for configuration loader
 * This will be replaced with proper tests once Jest/Vitest is set up in task 1
 */

// Load environment variables from .env file
import "dotenv/config";

import {
  loadConfig,
  getConfig,
  resetConfig,
  ConfigurationError,
} from "./config";

// Test 1: Load configuration with all required variables
console.log("Test 1: Loading configuration with required variables...");
try {
  const config = loadConfig();
  console.log("✓ Configuration loaded successfully");
  console.log("  Database URL:", config.database.url.substring(0, 30) + "...");
  console.log("  LLM Provider:", config.llm.provider);
  console.log("  LLM Model:", config.llm.modelName);
  console.log("  LLM Temperature:", config.llm.temperature);
  console.log("  Embedding Provider:", config.embedding.provider);
  console.log("  Embedding Model:", config.embedding.modelName);
  console.log("  Embedding Dimensions:", config.embedding.dimensions);
  console.log("  ChromaDB Host:", config.vectorStore.host);
  console.log("  ChromaDB Port:", config.vectorStore.port);
  console.log("  Max File Size:", config.processing.maxFileSizeMB, "MB");
  console.log("  Relevance Threshold:", config.processing.relevanceThreshold);
  console.log("  Chunk Size:", config.processing.chunkSize);
  console.log("  Chunk Overlap:", config.processing.chunkOverlap);
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.log("✗ Configuration error:", error.message);
  } else {
    console.log("✗ Unexpected error:", error);
  }
}

// Test 2: Verify singleton behavior
console.log("\nTest 2: Verifying singleton behavior...");
const config1 = getConfig();
const config2 = getConfig();
if (config1 === config2) {
  console.log("✓ Singleton pattern working correctly");
} else {
  console.log("✗ Singleton pattern not working");
}

// Test 3: Test missing required variable
console.log("\nTest 3: Testing missing required variable...");
const originalDatabaseUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
resetConfig();
try {
  loadConfig();
  console.log("✗ Should have thrown ConfigurationError");
} catch (error) {
  if (
    error instanceof ConfigurationError &&
    error.message.includes("DATABASE_URL")
  ) {
    console.log("✓ Correctly throws error for missing DATABASE_URL");
  } else {
    console.log("✗ Wrong error type or message:", error);
  }
}
process.env.DATABASE_URL = originalDatabaseUrl;
resetConfig();

// Test 4: Test invalid numeric values
console.log("\nTest 4: Testing invalid numeric values...");
const originalPort = process.env.CHROMA_PORT;
process.env.CHROMA_PORT = "invalid";
resetConfig();
try {
  loadConfig();
  console.log("✗ Should have thrown ConfigurationError for invalid port");
} catch (error) {
  if (
    error instanceof ConfigurationError &&
    error.message.includes("CHROMA_PORT")
  ) {
    console.log("✓ Correctly validates CHROMA_PORT");
  } else {
    console.log("✗ Wrong error:", error);
  }
}
process.env.CHROMA_PORT = originalPort;
resetConfig();

// Test 5: Test relevance threshold bounds
console.log("\nTest 5: Testing relevance threshold bounds...");
const originalThreshold = process.env.RELEVANCE_THRESHOLD;
process.env.RELEVANCE_THRESHOLD = "1.5";
resetConfig();
try {
  loadConfig();
  console.log("✗ Should have thrown ConfigurationError for invalid threshold");
} catch (error) {
  if (
    error instanceof ConfigurationError &&
    error.message.includes("RELEVANCE_THRESHOLD")
  ) {
    console.log("✓ Correctly validates RELEVANCE_THRESHOLD bounds");
  } else {
    console.log("✗ Wrong error:", error);
  }
}
process.env.RELEVANCE_THRESHOLD = originalThreshold;
resetConfig();

console.log("\n✓ All manual verification tests completed");
