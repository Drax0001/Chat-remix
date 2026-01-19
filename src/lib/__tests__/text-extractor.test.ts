/**
 * Unit tests for TextExtractor
 * Tests core text extraction functionality
 */

import { TextExtractor } from "../text-extractor";
import { ValidationError } from "../errors";

describe("TextExtractor", () => {
  let extractor: TextExtractor;

  beforeEach(() => {
    extractor = new TextExtractor();
  });

  describe("extractFromTxt", () => {
    it("should extract text from a TXT buffer", async () => {
      const text = "Hello, this is a test document.";
      const buffer = Buffer.from(text, "utf-8");

      const result = await extractor.extractFromTxt(buffer);

      expect(result).toBe(text);
    });

    it("should handle empty TXT files", async () => {
      const buffer = Buffer.from("", "utf-8");

      const result = await extractor.extractFromTxt(buffer);

      expect(result).toBe("");
    });
  });

  describe("extractFromUrl", () => {
    it("should throw ValidationError for invalid URL", async () => {
      await expect(extractor.extractFromUrl("not-a-url")).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError for invalid URL format", async () => {
      await expect(extractor.extractFromUrl("invalid://url")).rejects.toThrow(
        ValidationError
      );
    });
  });
});
