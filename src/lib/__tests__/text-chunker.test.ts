/**
 * Unit tests for TextChunker
 * Tests text chunking functionality with RecursiveCharacterTextSplitter
 */

import { TextChunker, ChunkMetadata } from "../text-chunker";

describe("TextChunker", () => {
  let chunker: TextChunker;

  beforeEach(() => {
    chunker = new TextChunker();
  });

  describe("chunkText", () => {
    it("should split text into chunks with preserved metadata", async () => {
      const text = "This is a test document. ".repeat(100); // ~2500 characters
      const metadata: ChunkMetadata = {
        documentId: "test-doc-123",
        filename: "test.txt",
      };

      const chunks = await chunker.chunkText(text, metadata);

      // Should create multiple chunks for text longer than 1000 characters
      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should have the preserved metadata
      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.documentId).toBe("test-doc-123");
        expect(chunk.metadata.filename).toBe("test.txt");
        expect(chunk.metadata.chunkIndex).toBe(index);
        expect(chunk.text).toBeDefined();
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });

    it("should handle short text that fits in a single chunk", async () => {
      const text = "This is a short text.";
      const metadata: ChunkMetadata = {
        documentId: "short-doc",
        filename: "short.txt",
      };

      const chunks = await chunker.chunkText(text, metadata);

      expect(chunks.length).toBe(1);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].metadata.documentId).toBe("short-doc");
      expect(chunks[0].metadata.chunkIndex).toBe(0);
    });

    it("should respect chunk size constraint", async () => {
      const text = "A".repeat(5000); // 5000 characters
      const metadata: ChunkMetadata = {
        documentId: "long-doc",
        filename: "long.txt",
      };

      const chunks = await chunker.chunkText(text, metadata);

      // Each chunk should be approximately 1000 characters (±10% for boundaries)
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(1100);
      });
    });

    it("should preserve additional metadata fields", async () => {
      const text = "Test text for metadata preservation.";
      const metadata: ChunkMetadata = {
        documentId: "meta-doc",
        filename: "meta.txt",
        customField: "custom value",
        pageNumber: 42,
      };

      const chunks = await chunker.chunkText(text, metadata);

      expect(chunks[0].metadata.customField).toBe("custom value");
      expect(chunks[0].metadata.pageNumber).toBe(42);
    });

    it("should handle empty text", async () => {
      const text = "";
      const metadata: ChunkMetadata = {
        documentId: "empty-doc",
        filename: "empty.txt",
      };

      const chunks = await chunker.chunkText(text, metadata);

      expect(chunks.length).toBe(0);
    });
  });
});
