/**
 * Text extraction utilities for RAG Chatbot Backend
 * Implements text extraction from various document formats using LangChain loaders
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { ValidationError } from "./errors";
import * as cheerio from "cheerio";

/**
 * TextExtractor class provides methods to extract text from various document formats
 * Uses LangChain-compatible document loaders for consistent text extraction
 */
export class TextExtractor {
  /**
   * Extract text from PDF file using pdf-parse
   * Requirements: 3.1
   *
   * @param buffer - PDF file buffer
   * @returns Extracted text content
   * @throws ValidationError if extraction fails
   */
  async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      // pdf-parse uses CommonJS, so we need to use require
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new ValidationError(
        `Failed to extract text from PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text from DOCX file
   * Requirements: 3.2
   *
   * @param buffer - DOCX file buffer
   * @returns Extracted text content
   * @throws ValidationError if extraction fails
   */
  async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      // Import mammoth dynamically to handle DOCX files
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new ValidationError(
        `Failed to extract text from DOCX: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text from TXT file
   * Requirements: 3.3
   *
   * @param buffer - TXT file buffer
   * @returns Extracted text content
   * @throws ValidationError if extraction fails
   */
  async extractFromTxt(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString("utf-8");
    } catch (error) {
      throw new ValidationError(
        `Failed to extract text from TXT: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Extract text from URL using Cheerio
   * Requirements: 3.4
   *
   * @param url - URL to extract text from
   * @returns Extracted text content
   * @throws ValidationError if extraction fails or URL is invalid
   */
  async extractFromUrl(url: string): Promise<string> {
    try {
      // Validate URL format
      new URL(url);

      // Fetch the HTML content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Parse HTML and extract text using Cheerio
      const $ = cheerio.load(html);

      // Remove script and style elements
      $("script, style").remove();

      // Extract text content
      const text = $("body").text();

      // Clean up whitespace
      return text.replace(/\s+/g, " ").trim();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("Invalid URL")) {
        throw new ValidationError(`Invalid URL format: ${url}`);
      }
      throw new ValidationError(
        `Failed to extract text from URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
