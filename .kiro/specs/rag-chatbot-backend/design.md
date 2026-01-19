# Design Document: RAG Chatbot Backend

## Overview

This design document specifies the architecture and implementation details for a Retrieval-Augmented Generation (RAG) based chatbot backend built on Next.js 16 App Router, LangChain, ChromaDB, and Prisma with PostgreSQL.

The system implements a knowledge-restricted AI chatbot where the LLM can only answer questions based on user-uploaded documents. The core principle is that the LLM serves as a reasoning engine, not a knowledge source—all knowledge comes exclusively from retrieved document chunks.

**Key Design Principles:**

- RAG-first architecture: retrieval drives all responses
- Strict anti-hallucination measures through relevance thresholds
- Project-level data isolation in both vector and metadata databases
- Model-agnostic design supporting multiple LLM providers
- Asynchronous document processing pipeline
- Type-safe implementation using TypeScript and Zod

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Frontend)                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Controllers)            │
│  /api/projects, /api/documents/upload, /api/chat        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  ProjectService, DocumentService, ChatService           │
└─────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────┬──────────────────────────────────┐
│   RAG Pipeline       │      Database Layer              │
│  - Text Extraction   │   - Prisma Client                │
│  - Chunking          │   - PostgreSQL                   │
│  - Embedding         │                                  │
│  - Retrieval         │                                  │
└──────────────────────┴──────────────────────────────────┘
                            ↓
┌──────────────────────┬──────────────────────────────────┐
│   Vector Database    │      LLM Provider                │
│   ChromaDB           │   Google Gemini / Local LLM      │
└──────────────────────┴──────────────────────────────────┘
```

### Data Flow

**Document Ingestion Flow:**

1. Client uploads document → API route validates request
2. Controller saves file metadata to PostgreSQL (status: pending)
3. Service layer extracts text using appropriate LangChain loader
4. Text splitter creates chunks with overlap
5. Embedding model generates vectors for each chunk
6. Vectors stored in ChromaDB with project-specific collection
7. Document status updated to ready (or failed on error)

**Query/Chat Flow:**

1. Client sends query → API route validates request
2. Service layer generates query embedding
3. ChromaDB performs similarity search (top 5, filtered by project)
4. System checks relevance threshold (0.75)
5. If threshold met: assemble context, construct prompt, invoke LLM
6. If threshold not met: return "I don't know"
7. Return response with source count to client

## Components and Interfaces

### 1. API Route Handlers (Controllers)

**Location:** `app/api/*/route.ts`

**POST /api/projects**

```typescript
Request: {
  name: string;
}
Response: {
  id: string;
  name: string;
  createdAt: string;
}
```

**GET /api/projects/:id**

```typescript
Response: {
  id: string;
  name: string;
  createdAt: string;
  documentCount: number;
}
```

**DELETE /api/projects/:id**

```typescript
Response: {
  success: boolean;
}
```

**POST /api/documents/upload**

```typescript
Request: FormData {
  projectId: string
  file?: File
  url?: string
}
Response: {
  id: string
  filename: string
  status: "pending" | "processing" | "ready" | "failed"
}
```

**POST /api/chat**

```typescript
Request: {
  projectId: string;
  message: string;
}
Response: {
  answer: string;
  sourceCount: number;
}
```

### 2. Service Layer

**ProjectService**

```typescript
interface ProjectService {
  createProject(name: string): Promise<Project>;
  getProject(id: string): Promise<ProjectWithDocuments>;
  deleteProject(id: string): Promise<void>;
}
```

**DocumentService**

```typescript
interface DocumentService {
  uploadDocument(projectId: string, file: File): Promise<Document>;
  uploadUrl(projectId: string, url: string): Promise<Document>;
  processDocument(documentId: string): Promise<void>;
}
```

**ChatService**

```typescript
interface ChatService {
  processQuery(projectId: string, message: string): Promise<ChatResponse>;
}
```

### 3. RAG Pipeline Components

**TextExtractor**

```typescript
interface TextExtractor {
  extractFromPdf(buffer: Buffer): Promise<string>;
  extractFromDocx(buffer: Buffer): Promise<string>;
  extractFromTxt(buffer: Buffer): Promise<string>;
  extractFromUrl(url: string): Promise<string>;
}
```

**TextChunker**

```typescript
interface TextChunker {
  chunkText(text: string, metadata: ChunkMetadata): Promise<Chunk[]>;
}

interface Chunk {
  text: string;
  metadata: {
    documentId: string;
    filename: string;
    chunkIndex: number;
  };
}
```

**EmbeddingService**

```typescript
interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}
```

**VectorStore**

```typescript
interface VectorStore {
  createCollection(projectId: string): Promise<void>;
  addDocuments(
    projectId: string,
    chunks: Chunk[],
    embeddings: number[][]
  ): Promise<void>;
  similaritySearch(
    projectId: string,
    queryEmbedding: number[],
    k: number
  ): Promise<SearchResult[]>;
  deleteCollection(projectId: string): Promise<void>;
}

interface SearchResult {
  text: string;
  score: number;
  metadata: ChunkMetadata;
}
```

**LLMService**

```typescript
interface LLMService {
  generateResponse(systemPrompt: string, userPrompt: string): Promise<string>;
}
```

### 4. Database Layer (Prisma)

**Prisma Schema:**

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  documents Document[]
}

model Document {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  filename    String
  fileType    String
  status      String   // "pending" | "processing" | "ready" | "failed"
  uploadedAt  DateTime @default(now())
  errorMessage String?
}
```

## Data Models

### Core Domain Models

**Project**

```typescript
interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

interface ProjectWithDocuments extends Project {
  documents: Document[];
  documentCount: number;
}
```

**Document**

```typescript
interface Document {
  id: string;
  projectId: string;
  filename: string;
  fileType: "pdf" | "docx" | "txt" | "url";
  status: DocumentStatus;
  uploadedAt: Date;
  errorMessage?: string;
}

type DocumentStatus = "pending" | "processing" | "ready" | "failed";
```

**ChatMessage**

```typescript
interface ChatRequest {
  projectId: string;
  message: string;
}

interface ChatResponse {
  answer: string;
  sourceCount: number;
}
```

### Configuration Models

**LLMConfig**

```typescript
interface LLMConfig {
  provider: "gemini" | "local";
  apiKey?: string;
  endpoint?: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}
```

**EmbeddingConfig**

```typescript
interface EmbeddingConfig {
  provider: "gemini" | "local";
  apiKey?: string;
  endpoint?: string;
  modelName: string;
  dimensions: number;
}
```

**ChunkingConfig**

```typescript
interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}
```

### Validation Schemas (Zod)

```typescript
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

const UploadDocumentSchema = z
  .object({
    projectId: z.string().cuid(),
    file: z.instanceof(File).optional(),
    url: z.string().url().optional(),
  })
  .refine((data) => data.file || data.url, {
    message: "Either file or url must be provided",
  });

const ChatRequestSchema = z.object({
  projectId: z.string().cuid(),
  message: z.string().min(1).max(2000),
});
```

## Implementation Details

### Document Processing Pipeline

**Step 1: File Upload and Validation**

- Validate file size (PDF/DOCX: 10MB, TXT: 5MB)
- Validate file type using MIME type detection
- Store file temporarily or in memory buffer
- Create database record with status "pending"

**Step 2: Text Extraction**

```typescript
async function extractText(
  document: Document,
  buffer: Buffer
): Promise<string> {
  switch (document.fileType) {
    case "pdf":
      const pdfLoader = new PDFLoader(buffer);
      return await pdfLoader.load();
    case "docx":
      const docxLoader = new DocxLoader(buffer);
      return await docxLoader.load();
    case "txt":
      const textLoader = new TextLoader(buffer);
      return await textLoader.load();
    case "url":
      const webLoader = new CheerioWebBaseLoader(document.filename); // filename stores URL
      return await webLoader.load();
  }
}
```

**Step 3: Text Chunking**

```typescript
async function chunkText(text: string, documentId: string): Promise<Chunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const chunks = await splitter.splitText(text);

  return chunks.map((text, index) => ({
    text,
    metadata: {
      documentId,
      chunkIndex: index,
    },
  }));
}
```

**Step 4: Embedding Generation**

```typescript
async function generateEmbeddings(chunks: Chunk[]): Promise<number[][]> {
  const embeddingModel = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "embedding-001",
  });

  const texts = chunks.map((c) => c.text);
  return await embeddingModel.embedDocuments(texts);
}
```

**Step 5: Vector Storage**

```typescript
async function storeVectors(
  projectId: string,
  chunks: Chunk[],
  embeddings: number[][]
): Promise<void> {
  const chromaClient = new ChromaClient();
  const collection = await chromaClient.getOrCreateCollection({
    name: `project_${projectId}`,
  });

  await collection.add({
    ids: chunks.map((_, i) => `${chunks[i].metadata.documentId}_${i}`),
    embeddings: embeddings,
    documents: chunks.map((c) => c.text),
    metadatas: chunks.map((c) => c.metadata),
  });
}
```

### Query Processing Pipeline

**Step 1: Query Embedding**

```typescript
async function embedQuery(message: string): Promise<number[]> {
  const embeddingModel = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "embedding-001",
  });

  return await embeddingModel.embedQuery(message);
}
```

**Step 2: Similarity Search**

```typescript
async function searchSimilarChunks(
  projectId: string,
  queryEmbedding: number[],
  k: number = 5
): Promise<SearchResult[]> {
  const chromaClient = new ChromaClient();
  const collection = await chromaClient.getCollection({
    name: `project_${projectId}`,
  });

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: k,
  });

  return results.documents[0].map((text, i) => ({
    text,
    score: results.distances[0][i],
    metadata: results.metadatas[0][i],
  }));
}
```

**Step 3: Relevance Filtering**

```typescript
function checkRelevanceThreshold(results: SearchResult[]): boolean {
  if (results.length === 0) return false;

  const highestScore = Math.max(...results.map((r) => r.score));
  return highestScore >= 0.75;
}
```

**Step 4: Context Assembly**

```typescript
function assembleContext(
  results: SearchResult[],
  maxTokens: number = 3000
): string {
  // Sort by score descending
  const sorted = results.sort((a, b) => b.score - a.score);

  let context = "";
  let tokenCount = 0;

  for (const result of sorted) {
    const chunkTokens = estimateTokens(result.text);
    if (tokenCount + chunkTokens > maxTokens) break;

    context += result.text + "\n\n";
    tokenCount += chunkTokens;
  }

  return context.trim();
}

function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
```

**Step 5: Prompt Construction**

```typescript
function constructPrompt(
  context: string,
  userMessage: string
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a factual assistant. Answer ONLY using the provided context. If the answer is not explicitly present, respond exactly: "I don't know."`;

  const userPrompt = `Context:
${context}

Question: ${userMessage}`;

  return { systemPrompt, userPrompt };
}
```

**Step 6: LLM Invocation**

```typescript
async function invokeLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "gemini-pro",
    temperature: 0.3,
    maxOutputTokens: 1024,
  });

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];

  const response = await model.invoke(messages);
  return response.content;
}
```

### Error Handling Strategy

**Database Errors**

```typescript
try {
  await prisma.project.create({ data: { name } });
} catch (error) {
  if (error.code === "P2002") {
    throw new ConflictError("Project name already exists");
  }
  throw new DatabaseError("Failed to create project");
}
```

**Vector Store Errors**

```typescript
try {
  await chromaClient.getCollection({ name: collectionName });
} catch (error) {
  if (error.message.includes("not found")) {
    throw new NotFoundError("Project collection not found");
  }
  throw new VectorStoreError("Failed to access vector store");
}
```

**LLM Errors**

```typescript
try {
  const response = await model.invoke(messages);
  return response.content;
} catch (error) {
  if (error.message.includes("quota")) {
    throw new QuotaExceededError("LLM API quota exceeded");
  }
  if (error.message.includes("timeout")) {
    throw new TimeoutError("LLM request timed out");
  }
  throw new LLMError("Failed to generate response");
}
```

### Configuration Management

**Environment Variables**

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rag_chatbot

# Google Gemini
GOOGLE_API_KEY=your_api_key_here

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Application
NODE_ENV=development
MAX_FILE_SIZE_MB=10
RELEVANCE_THRESHOLD=0.75
```

**Configuration Loader**

```typescript
interface AppConfig {
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

function loadConfig(): AppConfig {
  return {
    database: {
      url: process.env.DATABASE_URL!,
    },
    llm: {
      provider: "gemini",
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "gemini-pro",
      temperature: 0.3,
      maxTokens: 1024,
    },
    embedding: {
      provider: "gemini",
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: "embedding-001",
      dimensions: 768,
    },
    vectorStore: {
      host: process.env.CHROMA_HOST || "localhost",
      port: parseInt(process.env.CHROMA_PORT || "8000"),
    },
    processing: {
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || "10"),
      relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD || "0.75"),
      chunkSize: 1000,
      chunkOverlap: 200,
    },
  };
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

The following properties define the correctness criteria for the RAG chatbot backend. Each property is universally quantified and references the specific requirements it validates.

### Project Management Properties

**Property 1: Unique Project Identifiers**

_For any_ project creation request with a valid name, the system should generate a unique project identifier that does not conflict with any existing project ID in the database.

**Validates: Requirements 1.1**

**Property 2: Complete Project Details**

_For any_ existing project, retrieving project details should return an object containing the project name, creation timestamp, and accurate document count matching the number of documents associated with that project.

**Validates: Requirements 1.2**

**Property 3: Cascade Deletion**

_For any_ project with associated documents, deleting the project should result in complete removal of both the project record and all associated document records from the metadata database, and removal of the project's collection from the vector database.

**Validates: Requirements 1.3**

**Property 4: Project Isolation**

_For any_ two distinct projects with different document sets, querying one project should return results exclusively from that project's collection, with zero results from the other project's documents.

**Validates: Requirements 1.4**

### Document Upload and Validation Properties

**Property 5: File Size Validation by Type**

_For any_ uploaded file, the system should accept the file if and only if its size is within the type-specific limit (PDF/DOCX ≤ 10MB, TXT ≤ 5MB), and reject files exceeding these limits with a descriptive error message.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

**Property 6: URL Format Validation**

_For any_ string provided as a URL, the system should accept it if and only if it is a properly formatted HTTP or HTTPS URL according to RFC 3986.

**Validates: Requirements 2.4**

**Property 7: Unsupported File Type Rejection**

_For any_ uploaded file with a MIME type not in the supported set (PDF, DOCX, TXT), the system should reject the upload and return a descriptive error message indicating the unsupported format.

**Validates: Requirements 2.6**

### Text Extraction Properties

**Property 8: Extraction Failure Handling**

_For any_ document where text extraction fails (due to corruption, invalid format, or processing error), the system should update the document status to "failed" and store a descriptive error message in the database.

**Validates: Requirements 3.5**

### Text Chunking Properties

**Property 9: Chunk Size Constraint**

_For any_ text longer than 1000 characters, the chunking process should produce chunks where each chunk's length is approximately 1000 characters (±10% to account for separator boundaries).

**Validates: Requirements 4.2**

**Property 10: Chunk Overlap Preservation**

_For any_ sequence of consecutive chunks from the same document, each pair of adjacent chunks should share approximately 200 characters of overlapping content.

**Validates: Requirements 4.3**

**Property 11: Metadata Preservation**

_For any_ document with metadata (filename, document ID), all chunks generated from that document should retain the complete metadata in their metadata field.

**Validates: Requirements 4.4**

### Embedding and Storage Properties

**Property 12: Complete Embedding Generation**

_For any_ set of chunks created from a document, the system should generate an embedding vector for every chunk without skipping any.

**Validates: Requirements 5.1**

**Property 13: Vector Storage Round-Trip**

_For any_ chunk with its embedding stored in ChromaDB, retrieving the chunk by its ID should return the exact same chunk text that was originally stored.

**Validates: Requirements 5.2**

**Property 14: Collection Isolation**

_For any_ two distinct projects, embeddings stored for one project should be stored in a collection named uniquely for that project, ensuring no cross-contamination between project collections.

**Validates: Requirements 5.3**

**Property 15: Successful Processing Status**

_For any_ document where all chunks are successfully embedded and stored, the document status should be updated to "ready" in the metadata database.

**Validates: Requirements 5.4, 12.4**

**Property 16: Failed Processing Status**

_For any_ document where embedding generation or storage fails for any chunk, the document status should be updated to "failed" in the metadata database.

**Validates: Requirements 5.5, 12.5**

### Query Processing Properties

**Property 17: Project Existence Validation**

_For any_ chat query, if the provided project ID does not exist in the database, the system should reject the query and return an error message indicating the invalid project.

**Validates: Requirements 6.1, 6.3**

**Property 18: Embedding Dimension Consistency**

_For any_ user query, the generated query embedding should have the same vector dimensions as the document embeddings, ensuring compatibility for similarity search.

**Validates: Requirements 6.2**

### Similarity Search Properties

**Property 19: Project-Filtered Search**

_For any_ query embedding and project ID, the similarity search should only return chunks from the specified project's collection, with no results from other projects.

**Validates: Requirements 7.1**

**Property 20: Top-K Retrieval**

_For any_ similarity search, the system should return exactly 5 results (or fewer if the project contains fewer than 5 chunks), representing the most similar chunks.

**Validates: Requirements 7.2**

**Property 21: Complete Search Results**

_For any_ similarity search result, each returned item should contain both the chunk text and its similarity score.

**Validates: Requirements 7.3**

**Property 22: Score-Ordered Results**

_For any_ similarity search returning multiple results, the results should be ordered in descending order by similarity score (highest score first).

**Validates: Requirements 7.4**

### Anti-Hallucination Properties

**Property 23: Relevance Threshold Enforcement**

_For any_ query where the highest similarity score from the search results is less than 0.75, the system should return a response with answer "I don't know" and sourceCount 0, without invoking the LLM.

**Validates: Requirements 8.2, 8.4**

**Property 24: Context Assembly Trigger**

_For any_ query where the highest similarity score is greater than or equal to 0.75, the system should proceed with context assembly and LLM invocation.

**Validates: Requirements 8.3**

### Context Assembly Properties

**Property 25: Ranked Context Concatenation**

_For any_ set of retrieved chunks passing the relevance threshold, the assembled context should concatenate the chunks in descending order by similarity score.

**Validates: Requirements 9.1**

**Property 26: Token Limit Enforcement**

_For any_ assembled context, the total estimated token count should not exceed the configured model-safe token limit.

**Validates: Requirements 9.2**

**Property 27: Truncation Preserves Ranking**

_For any_ scenario where concatenating all retrieved chunks would exceed token limits, the system should include only the highest-ranked chunks that fit within the limit, maintaining score-descending order.

**Validates: Requirements 9.3**

### Prompt Construction Properties

**Property 28: System Prompt Instruction**

_For any_ LLM invocation, the system prompt should contain the instruction to answer only using provided context.

**Validates: Requirements 10.1**

**Property 29: Exact Fallback Instruction**

_For any_ LLM invocation, the system prompt should contain the exact string: "If the answer is not explicitly present, respond exactly: I don't know"

**Validates: Requirements 10.2**

**Property 30: Complete User Prompt**

_For any_ LLM invocation, the user prompt should contain both the assembled context and the user's original question.

**Validates: Requirements 10.3**

**Property 31: Temperature Constraint**

_For any_ LLM invocation, the temperature parameter should be set to a value less than or equal to 0.3.

**Validates: Requirements 10.4**

### Response Generation Properties

**Property 32: Verbatim LLM Output**

_For any_ LLM-generated response, the system should return the model output exactly as generated, without any post-processing, modification, or "improvement".

**Validates: Requirements 11.1**

**Property 33: Source Count Accuracy**

_For any_ response, the sourceCount field should equal the number of chunks that were included in the context assembly for that query.

**Validates: Requirements 11.2**

**Property 34: Consistent Response Format**

_For any_ chat query (whether above or below relevance threshold), the response should be a JSON object containing exactly two fields: "answer" (string) and "sourceCount" (number).

**Validates: Requirements 11.3**

### Database Schema Properties

**Property 35: Initial Document Status**

_For any_ newly uploaded document, the database record should be created with status "pending" before any processing begins.

**Validates: Requirements 12.3**

### Input Validation Properties

**Property 36: Request Payload Validation**

_For any_ API endpoint receiving a request, if the payload does not conform to the endpoint's Zod schema, the system should reject the request and return a validation error with details about the schema violation.

**Validates: Requirements 13.6**

### Error Handling Properties

**Property 37: Structured Error Responses**

_For any_ API endpoint that encounters an error during processing, the response should be a structured JSON object containing an HTTP status code and a descriptive error message.

**Validates: Requirements 14.1**

**Property 38: Database Connection Failure Handling**

_For any_ request where either the Vector_Database or Metadata_Database connection fails, the system should return a 503 Service Unavailable HTTP status code.

**Validates: Requirements 14.4, 14.5**

### Configuration Properties

**Property 39: Embedding Dimension Compatibility**

_For any_ model configuration change (switching between Gemini and local LLM), the new embedding model should produce vectors with the same dimensions as the previous model to maintain compatibility with existing stored embeddings.

**Validates: Requirements 15.4**

**Property 40: Configuration Validation**

_For any_ system startup or request processing, if required API keys or endpoints are not configured in environment variables, the system should fail gracefully with a clear error message indicating the missing configuration.

**Validates: Requirements 15.5**

## Error Handling

### Error Classification

The system implements a hierarchical error handling strategy with custom error classes:

```typescript
// Base error class
class AppError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500, "DATABASE_ERROR");
  }
}

class VectorStoreError extends AppError {
  constructor(message: string) {
    super(message, 500, "VECTOR_STORE_ERROR");
  }
}

class LLMError extends AppError {
  constructor(message: string) {
    super(message, 500, "LLM_ERROR");
  }
}

class QuotaExceededError extends AppError {
  constructor(message: string) {
    super(message, 429, "QUOTA_EXCEEDED");
  }
}

class TimeoutError extends AppError {
  constructor(message: string) {
    super(message, 504, "TIMEOUT");
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
```

### Error Handler Middleware

```typescript
function errorHandler(error: unknown): Response {
  // Log error for debugging
  console.error("Error occurred:", error);

  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  // Zod validation errors
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request payload",
          details: error.errors,
        },
      },
      { status: 400 }
    );
  }

  // Prisma errors
  if (error?.constructor?.name === "PrismaClientKnownRequestError") {
    const prismaError = error as any;
    if (prismaError.code === "P2002") {
      return Response.json(
        {
          error: {
            code: "CONFLICT",
            message: "Resource already exists",
          },
        },
        { status: 409 }
      );
    }
    if (prismaError.code === "P2025") {
      return Response.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Resource not found",
          },
        },
        { status: 404 }
      );
    }
  }

  // Unknown errors
  return Response.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}
```

### Error Handling in API Routes

```typescript
// Example: POST /api/chat
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, message } = ChatRequestSchema.parse(body);

    const chatService = new ChatService();
    const response = await chatService.processQuery(projectId, message);

    return Response.json(response);
  } catch (error) {
    return errorHandler(error);
  }
}
```

### Retry Logic for Transient Failures

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors or not found errors
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError!;
}
```

### Circuit Breaker for External Services

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(private threshold: number = 5, private timeout: number = 60000) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime! > this.timeout) {
        this.state = "half-open";
      } else {
        throw new ServiceUnavailableError("Service temporarily unavailable");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "open";
    }
  }
}

// Usage
const chromaCircuitBreaker = new CircuitBreaker();
const llmCircuitBreaker = new CircuitBreaker();
```

## Testing Strategy

### Overview

The testing strategy employs a dual approach combining unit tests and property-based tests to ensure comprehensive coverage and correctness validation.

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property-Based Tests**: Verify universal properties across all inputs using randomized test data

Both testing approaches are complementary and necessary for comprehensive coverage. Unit tests catch concrete bugs in specific scenarios, while property-based tests verify general correctness across a wide input space.

### Testing Framework Selection

**Unit Testing**: Jest with TypeScript support
**Property-Based Testing**: fast-check library
**Integration Testing**: Supertest for API endpoint testing
**Database Testing**: Prisma with in-memory SQLite for tests
**Mocking**: jest.mock() for external dependencies

### Test Configuration

```typescript
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Property-Based Test Configuration

Each property-based test must:

- Run a minimum of 100 iterations to ensure adequate randomization coverage
- Include a comment tag referencing the design document property
- Use descriptive test names that explain the property being validated

**Tag Format**: `// Feature: rag-chatbot-backend, Property {number}: {property_text}`

### Test Organization

```
src/
├── services/
│   ├── __tests__/
│   │   ├── project.service.test.ts
│   │   ├── document.service.test.ts
│   │   ├── chat.service.test.ts
│   │   └── rag.service.test.ts
│   ├── project.service.ts
│   ├── document.service.ts
│   ├── chat.service.ts
│   └── rag.service.ts
├── lib/
│   ├── __tests__/
│   │   ├── text-extractor.test.ts
│   │   ├── text-chunker.test.ts
│   │   ├── embedding.test.ts
│   │   └── vector-store.test.ts
│   ├── text-extractor.ts
│   ├── text-chunker.ts
│   ├── embedding.ts
│   └── vector-store.ts
└── app/
    └── api/
        ├── __tests__/
        │   ├── projects.test.ts
        │   ├── documents.test.ts
        │   └── chat.test.ts
        ├── projects/
        ├── documents/
        └── chat/
```

### Unit Test Examples

**Example 1: Project Creation**

```typescript
describe("ProjectService", () => {
  describe("createProject", () => {
    it("should create a project with valid name", async () => {
      const service = new ProjectService();
      const project = await service.createProject("Test Project");

      expect(project.id).toBeDefined();
      expect(project.name).toBe("Test Project");
      expect(project.createdAt).toBeInstanceOf(Date);
    });

    it("should reject empty project name", async () => {
      const service = new ProjectService();

      await expect(service.createProject("")).rejects.toThrow(ValidationError);
    });
  });
});
```

**Example 2: Relevance Threshold**

```typescript
describe("ChatService", () => {
  describe("processQuery", () => {
    it('should return "I don\'t know" when similarity score is below threshold', async () => {
      const service = new ChatService();

      // Mock vector store to return low similarity scores
      jest.spyOn(vectorStore, "similaritySearch").mockResolvedValue([
        { text: "chunk1", score: 0.5, metadata: {} },
        { text: "chunk2", score: 0.4, metadata: {} },
      ]);

      const response = await service.processQuery("project-id", "test query");

      expect(response.answer).toBe("I don't know");
      expect(response.sourceCount).toBe(0);
    });
  });
});
```

### Property-Based Test Examples

**Example 1: Project Isolation (Property 4)**

```typescript
import * as fc from "fast-check";

describe("RAG System Properties", () => {
  // Feature: rag-chatbot-backend, Property 4: Project Isolation
  it("should enforce project-level data isolation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }), // project1 docs
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }), // project2 docs
        fc.string(), // query
        async (project1Docs, project2Docs, query) => {
          // Create two projects with distinct documents
          const project1 = await createProjectWithDocuments(project1Docs);
          const project2 = await createProjectWithDocuments(project2Docs);

          // Query project1
          const results = await chatService.processQuery(project1.id, query);

          // Verify no results come from project2
          const resultTexts = results.sources?.map((s) => s.text) || [];
          const containsProject2Data = resultTexts.some((text) =>
            project2Docs.includes(text)
          );

          expect(containsProject2Data).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: rag-chatbot-backend, Property 5: File Size Validation by Type
  it("should validate file sizes according to type-specific limits", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constant("pdf"), fc.constant("docx"), fc.constant("txt")),
        fc.integer({ min: 0, max: 20 * 1024 * 1024 }), // 0-20MB
        async (fileType, fileSizeBytes) => {
          const file = createMockFile(fileType, fileSizeBytes);

          const limit = fileType === "txt" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
          const shouldAccept = fileSizeBytes <= limit;

          if (shouldAccept) {
            await expect(
              documentService.uploadDocument("project-id", file)
            ).resolves.toBeDefined();
          } else {
            await expect(
              documentService.uploadDocument("project-id", file)
            ).rejects.toThrow(ValidationError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: rag-chatbot-backend, Property 13: Vector Storage Round-Trip
  it("should preserve chunk text through storage and retrieval", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 1000 }),
        async (chunkText) => {
          const chunk = { text: chunkText, metadata: { documentId: "test" } };
          const embedding = await embeddingService.generateEmbedding(chunkText);

          // Store
          await vectorStore.addDocuments("project-id", [chunk], [embedding]);

          // Retrieve
          const results = await vectorStore.similaritySearch(
            "project-id",
            embedding,
            1
          );

          expect(results[0].text).toBe(chunkText);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: rag-chatbot-backend, Property 22: Score-Ordered Results
  it("should return search results in descending score order", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 5, maxLength: 20 }),
        fc.string(),
        async (documents, query) => {
          const projectId = await setupProjectWithDocuments(documents);
          const queryEmbedding = await embeddingService.generateEmbedding(
            query
          );

          const results = await vectorStore.similaritySearch(
            projectId,
            queryEmbedding,
            5
          );

          // Verify descending order
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].score).toBeGreaterThanOrEqual(
              results[i + 1].score
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: rag-chatbot-backend, Property 23: Relevance Threshold Enforcement
  it('should return "I don\'t know" when highest score is below 0.75', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.array(fc.tuple(fc.string(), fc.float({ min: 0, max: 0.74 }))),
        async (query, chunksWithLowScores) => {
          // Mock vector store to return low scores
          jest.spyOn(vectorStore, "similaritySearch").mockResolvedValue(
            chunksWithLowScores.map(([text, score]) => ({
              text,
              score,
              metadata: {},
            }))
          );

          const response = await chatService.processQuery("project-id", query);

          expect(response.answer).toBe("I don't know");
          expect(response.sourceCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Test Examples

```typescript
import request from "supertest";
import { app } from "../app";

describe("API Integration Tests", () => {
  describe("POST /api/projects", () => {
    it("should create a project and return 201", async () => {
      const response = await request(app)
        .post("/api/projects")
        .send({ name: "Test Project" })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe("Test Project");
    });
  });

  describe("POST /api/chat", () => {
    it("should process query and return answer", async () => {
      // Setup: create project and upload documents
      const project = await createTestProject();
      await uploadTestDocuments(project.id);

      const response = await request(app)
        .post("/api/chat")
        .send({
          projectId: project.id,
          message: "What is the main topic?",
        })
        .expect(200);

      expect(response.body.answer).toBeDefined();
      expect(response.body.sourceCount).toBeGreaterThan(0);
    });

    it("should return 404 for non-existent project", async () => {
      await request(app)
        .post("/api/chat")
        .send({
          projectId: "non-existent-id",
          message: "test query",
        })
        .expect(404);
    });
  });
});
```

### Test Data Generators for Property-Based Tests

```typescript
// Custom arbitraries for domain-specific data
const projectNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });

const documentContentArbitrary = fc.string({
  minLength: 100,
  maxLength: 10000,
});

const chunkArbitrary = fc.record({
  text: fc.string({ minLength: 10, maxLength: 1000 }),
  metadata: fc.record({
    documentId: fc.uuid(),
    chunkIndex: fc.integer({ min: 0, max: 100 }),
  }),
});

const similarityScoreArbitrary = fc.float({ min: 0, max: 1 });

const urlArbitrary = fc.webUrl();
```

### Mocking Strategy

**External Services to Mock:**

- Google Gemini API (LLM calls)
- Google Embedding API
- ChromaDB (for unit tests, use real instance for integration tests)
- File system operations

**Example Mock Setup:**

```typescript
jest.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: "Mocked LLM response",
    }),
  })),
  GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
    embedDocuments: jest.fn().mockResolvedValue([new Array(768).fill(0.1)]),
  })),
}));
```

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% line coverage
- **Property Test Coverage**: All correctness properties must have corresponding property-based tests
- **Integration Test Coverage**: All API endpoints must have integration tests
- **Edge Case Coverage**: All error conditions and boundary cases must be tested

### Continuous Integration

Tests should run automatically on:

- Every pull request
- Every commit to main branch
- Nightly builds for extended property-based test runs (1000+ iterations)

### Performance Testing

While not part of the core testing strategy, performance benchmarks should be established for:

- Document processing throughput (documents/minute)
- Query response time (p50, p95, p99)
- Embedding generation time
- Vector search latency

These benchmarks help identify performance regressions during development.
