/**
 * Configuration Management Module
 *
 * This module loads and validates environment variables for the RAG chatbot backend.
 * It ensures all required configuration is present before the application starts.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.5
 */

/**
 * LLM Configuration
 * Supports both Google Gemini and local LLM endpoints
 */
export interface LLMConfig {
  provider: "gemini" | "local";
  apiKey?: string;
  endpoint?: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Embedding Model Configuration
 * Supports both Google Gemini and local embedding endpoints
 */
export interface EmbeddingConfig {
  provider: "gemini" | "local";
  apiKey?: string;
  endpoint?: string;
  modelName: string;
  dimensions: number;
}

/**
 * Text Chunking Configuration
 */
export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}

/**
 * Complete Application Configuration
 */
export interface AppConfig {
  database: {
    url: string;
  };
  llm: LLMConfig;
  embedding: EmbeddingConfig;
  vectorStore: {
    host: string;
    port: number;
  };
  processing: {
    maxFileSizeMB: number;
    relevanceThreshold: number;
    chunkSize: number;
    chunkOverlap: number;
  };
}

/**
 * Configuration Validation Error
 * Thrown when required environment variables are missing
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Validates that a required environment variable is present
 * @param name - The name of the environment variable
 * @param value - The value of the environment variable
 * @throws ConfigurationError if the value is missing
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new ConfigurationError(
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

/**
 * Loads and validates application configuration from environment variables
 *
 * Required environment variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - GOOGLE_API_KEY: Google Gemini API key (when using Gemini provider)
 *
 * Optional environment variables:
 * - CHROMA_HOST: ChromaDB host (default: localhost)
 * - CHROMA_PORT: ChromaDB port (default: 8000)
 * - MAX_FILE_SIZE_MB: Maximum file size in MB (default: 10)
 * - RELEVANCE_THRESHOLD: Minimum similarity score for answers (default: 0.75)
 * - LLM_PROVIDER: LLM provider (default: gemini)
 * - LLM_ENDPOINT: Local LLM endpoint (required if LLM_PROVIDER=local)
 * - LLM_MODEL_NAME: LLM model name (default: gemini-pro)
 * - LLM_TEMPERATURE: LLM temperature (default: 0.3)
 * - LLM_MAX_TOKENS: LLM max tokens (default: 1024)
 * - EMBEDDING_PROVIDER: Embedding provider (default: gemini)
 * - EMBEDDING_ENDPOINT: Local embedding endpoint (required if EMBEDDING_PROVIDER=local)
 * - EMBEDDING_MODEL_NAME: Embedding model name (default: embedding-001)
 * - EMBEDDING_DIMENSIONS: Embedding dimensions (default: 768)
 *
 * @returns AppConfig object with all configuration values
 * @throws ConfigurationError if required configuration is missing
 */
export function loadConfig(): AppConfig {
  // Validate required database configuration
  const databaseUrl = requireEnv("DATABASE_URL", process.env.DATABASE_URL);

  // Determine LLM provider
  const llmProvider = (process.env.LLM_PROVIDER || "gemini") as
    | "gemini"
    | "local";

  // Validate LLM configuration based on provider
  let llmApiKey: string | undefined;
  let llmEndpoint: string | undefined;

  if (llmProvider === "gemini") {
    llmApiKey = requireEnv("GOOGLE_API_KEY", process.env.GOOGLE_API_KEY);
  } else if (llmProvider === "local") {
    llmEndpoint = requireEnv("LLM_ENDPOINT", process.env.LLM_ENDPOINT);
  }

  // Determine embedding provider
  const embeddingProvider = (process.env.EMBEDDING_PROVIDER || "gemini") as
    | "gemini"
    | "local";

  // Validate embedding configuration based on provider
  let embeddingApiKey: string | undefined;
  let embeddingEndpoint: string | undefined;

  if (embeddingProvider === "gemini") {
    embeddingApiKey = requireEnv("GOOGLE_API_KEY", process.env.GOOGLE_API_KEY);
  } else if (embeddingProvider === "local") {
    embeddingEndpoint = requireEnv(
      "EMBEDDING_ENDPOINT",
      process.env.EMBEDDING_ENDPOINT
    );
  }

  // Parse numeric configuration with defaults
  const chromaPort = parseInt(process.env.CHROMA_PORT || "8000", 10);
  const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);
  const relevanceThreshold = parseFloat(
    process.env.RELEVANCE_THRESHOLD || "0.75"
  );
  const llmTemperature = parseFloat(process.env.LLM_TEMPERATURE || "0.3");
  const llmMaxTokens = parseInt(process.env.LLM_MAX_TOKENS || "1024", 10);
  const embeddingDimensions = parseInt(
    process.env.EMBEDDING_DIMENSIONS || "768",
    10
  );

  // Validate numeric values
  if (isNaN(chromaPort) || chromaPort <= 0 || chromaPort > 65535) {
    throw new ConfigurationError(
      "CHROMA_PORT must be a valid port number (1-65535)"
    );
  }

  if (isNaN(maxFileSizeMB) || maxFileSizeMB <= 0) {
    throw new ConfigurationError("MAX_FILE_SIZE_MB must be a positive number");
  }

  if (
    isNaN(relevanceThreshold) ||
    relevanceThreshold < 0 ||
    relevanceThreshold > 1
  ) {
    throw new ConfigurationError("RELEVANCE_THRESHOLD must be between 0 and 1");
  }

  if (isNaN(llmTemperature) || llmTemperature < 0 || llmTemperature > 1) {
    throw new ConfigurationError("LLM_TEMPERATURE must be between 0 and 1");
  }

  if (isNaN(llmMaxTokens) || llmMaxTokens <= 0) {
    throw new ConfigurationError("LLM_MAX_TOKENS must be a positive number");
  }

  if (isNaN(embeddingDimensions) || embeddingDimensions <= 0) {
    throw new ConfigurationError(
      "EMBEDDING_DIMENSIONS must be a positive number"
    );
  }

  return {
    database: {
      url: databaseUrl,
    },
    llm: {
      provider: llmProvider,
      apiKey: llmApiKey,
      endpoint: llmEndpoint,
      modelName: process.env.LLM_MODEL_NAME || "gemini-pro",
      temperature: llmTemperature,
      maxTokens: llmMaxTokens,
    },
    embedding: {
      provider: embeddingProvider,
      apiKey: embeddingApiKey,
      endpoint: embeddingEndpoint,
      modelName: process.env.EMBEDDING_MODEL_NAME || "embedding-001",
      dimensions: embeddingDimensions,
    },
    vectorStore: {
      host: process.env.CHROMA_HOST || "localhost",
      port: chromaPort,
    },
    processing: {
      maxFileSizeMB,
      relevanceThreshold,
      chunkSize: 1000,
      chunkOverlap: 200,
    },
  };
}

/**
 * Singleton configuration instance
 * Loaded once on first access to avoid repeated validation
 */
let configInstance: AppConfig | null = null;

/**
 * Gets the application configuration
 * Loads and validates configuration on first call, then returns cached instance
 *
 * @returns AppConfig object with all configuration values
 * @throws ConfigurationError if required configuration is missing
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Resets the configuration instance
 * Useful for testing purposes
 */
export function resetConfig(): void {
  configInstance = null;
}
