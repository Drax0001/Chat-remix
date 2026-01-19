/**
 * Example usage of EmbeddingService
 *
 * This file demonstrates how to use the EmbeddingService class to generate
 * embeddings for single texts and batches of texts.
 */

import "dotenv/config";
import { EmbeddingService } from "./embedding-service";

async function exampleUsage() {
  // Create an instance of the embedding service
  const embeddingService = new EmbeddingService();

  // Example 1: Generate embedding for a single text (e.g., user query)
  console.log("Example 1: Single text embedding");
  const queryText = "What is the capital of France?";
  const queryEmbedding = await embeddingService.generateEmbedding(queryText);
  console.log(`Query: "${queryText}"`);
  console.log(`Embedding dimensions: ${queryEmbedding.length}`);
  console.log(`First 5 values: [${queryEmbedding.slice(0, 5).join(", ")}...]`);
  console.log();

  // Example 2: Generate embeddings for multiple texts (e.g., document chunks)
  console.log("Example 2: Batch text embeddings");
  const chunks = [
    "Paris is the capital and most populous city of France.",
    "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris.",
    "The Louvre is the world's most-visited museum and a historic landmark in Paris.",
  ];

  const batchEmbeddings = await embeddingService.generateBatchEmbeddings(
    chunks
  );
  console.log(`Number of chunks: ${chunks.length}`);
  console.log(`Number of embeddings: ${batchEmbeddings.length}`);
  console.log(`Embedding dimensions: ${batchEmbeddings[0].length}`);
  console.log(
    `First embedding preview: [${batchEmbeddings[0].slice(0, 5).join(", ")}...]`
  );
  console.log();

  // Example 3: Verify embedding dimensions are consistent
  console.log("Example 3: Dimension consistency check");
  const singleDimensions = queryEmbedding.length;
  const batchDimensions = batchEmbeddings[0].length;
  console.log(`Single embedding dimensions: ${singleDimensions}`);
  console.log(`Batch embedding dimensions: ${batchDimensions}`);
  console.log(
    `Dimensions match: ${singleDimensions === batchDimensions ? "✓" : "✗"}`
  );
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage()
    .then(() => {
      console.log("\nExample completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nExample failed with error:");
      console.error(error);
      process.exit(1);
    });
}

export { exampleUsage };
