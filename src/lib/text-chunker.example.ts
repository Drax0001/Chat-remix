/**
 * Example usage of TextChunker
 * This file demonstrates how to use the TextChunker class
 */

import { TextChunker, ChunkMetadata } from "./text-chunker";

async function main() {
  const chunker = new TextChunker();

  // Example 1: Chunk a long text
  const longText = `
    This is a sample document that will be chunked into smaller pieces.
    The RecursiveCharacterTextSplitter will intelligently split this text
    at natural boundaries like paragraphs, sentences, and words.
    
    Each chunk will be approximately 1000 characters in size, with a 200
    character overlap to maintain context between chunks. This overlap is
    important for RAG systems to ensure that relevant information isn't
    lost at chunk boundaries.
    
    The metadata associated with each chunk will be preserved, including
    the document ID, filename, and any custom fields you provide.
  `.repeat(10); // Make it longer to demonstrate chunking

  const metadata: ChunkMetadata = {
    documentId: "example-doc-123",
    filename: "example.txt",
    author: "Test Author",
  };

  console.log("Original text length:", longText.length);
  console.log("\nChunking text...\n");

  const chunks = await chunker.chunkText(longText, metadata);

  console.log(`Created ${chunks.length} chunks\n`);

  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index}:`);
    console.log(`  Length: ${chunk.text.length} characters`);
    console.log(`  Document ID: ${chunk.metadata.documentId}`);
    console.log(`  Filename: ${chunk.metadata.filename}`);
    console.log(`  Chunk Index: ${chunk.metadata.chunkIndex}`);
    console.log(`  Author: ${chunk.metadata.author}`);
    console.log(`  Preview: ${chunk.text.substring(0, 100)}...`);
    console.log();
  });

  // Example 2: Short text that fits in one chunk
  const shortText = "This is a short document.";
  const shortMetadata: ChunkMetadata = {
    documentId: "short-doc",
    filename: "short.txt",
  };

  const shortChunks = await chunker.chunkText(shortText, shortMetadata);
  console.log(`Short text created ${shortChunks.length} chunk(s)`);
  console.log(`Chunk text: "${shortChunks[0].text}"`);
}

// Run the example
main().catch(console.error);
