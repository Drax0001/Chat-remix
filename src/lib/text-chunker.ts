/**
 * Text chunking utilities for RAG Chatbot Backend
 * Implements text chunking using LangChain's RecursiveCharacterTextSplitter
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Metadata associated with each chunk
 */
export interface ChunkMetadata {
  documentId: string;
  filename: string;
  chunkIndex?: number;
  [key: string]: any;
}

/**
 * Represents a text chunk with its metadata
 */
export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

/**
 * TextChunker class provides methods to split text into chunks
 * Uses LangChain's RecursiveCharacterTextSplitter for intelligent text segmentation
 */
export class TextChunker {
  private splitter: RecursiveCharacterTextSplitter;

  /**
   * Initialize TextChunker with configured chunk size and overlap
   * Requirements: 4.1, 4.2, 4.3
   */
  constructor() {
    // Configure RecursiveCharacterTextSplitter with specified parameters
    // Chunk size: 1000 characters (Requirement 4.2)
    // Chunk overlap: 200 characters (Requirement 4.3)
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ". ", " ", ""],
    });
  }

  /**
   * Split text into chunks while preserving metadata
   * Requirements: 4.1, 4.2, 4.3, 4.4
   *
   * @param text - Text content to chunk
   * @param metadata - Metadata to preserve with each chunk
   * @returns Array of chunks with preserved metadata
   */
  async chunkText(text: string, metadata: ChunkMetadata): Promise<Chunk[]> {
    // Split the text using RecursiveCharacterTextSplitter
    const textChunks = await this.splitter.splitText(text);

    // Map each text chunk to a Chunk object with preserved metadata
    // Requirement 4.4: Preserve metadata with each chunk
    const chunks: Chunk[] = textChunks.map(
      (chunkText: string, index: number) => ({
        text: chunkText,
        metadata: {
          ...metadata,
          chunkIndex: index,
        },
      })
    );

    return chunks;
  }
}
