# Implementation Plan: RAG Chatbot Backend

## Overview

This implementation plan breaks down the RAG chatbot backend into discrete, incremental coding tasks. Each task builds on previous work, with testing integrated throughout to validate correctness early. The implementation follows a bottom-up approach: database layer → core utilities → services → API routes.

## Tasks

- [ ] 1. Set up project infrastructure and dependencies

  - Install and configure all required dependencies (@langchain/core, @langchain/google-genai, chromadb, prisma, zod)
  - Configure TypeScript with strict mode
  - Set up Jest and fast-check for testing
  - Create environment variable configuration structure
  - _Requirements: 15.1, 15.3, 15.5_

- [x] 2. Set up database schema and Prisma client

  - [x] 2.1 Define Prisma schema for Project and Document models

    - Create schema with all required fields (id, name, createdAt, projectId, filename, fileType, status, uploadedAt, errorMessage)
    - Configure PostgreSQL connection
    - _Requirements: 12.1, 12.2_

  - [ ]\* 2.2 Write unit tests for database schema

    - Test Project table has required fields
    - Test Document table has required fields
    - _Requirements: 12.1, 12.2_

  - [x] 2.3 Generate Prisma client and run migrations
    - Generate TypeScript types from schema
    - Create initial migration
    - _Requirements: 12.1, 12.2_

- [x] 3. Implement configuration management

  - [x] 3.1 Create configuration loader for environment variables

    - Load database URL, API keys, ChromaDB connection, processing parameters
    - Implement validation for required configuration
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [ ]\* 3.2 Write property test for configuration validation
    - **Property 40: Configuration Validation**
    - **Validates: Requirements 15.5**

- [x] 4. Implement error handling infrastructure

  - [x] 4.1 Create custom error classes

    - Implement AppError base class and all specific error types (ValidationError, NotFoundError, DatabaseError, VectorStoreError, LLMError, etc.)
    - _Requirements: 14.1_

  - [x] 4.2 Create centralized error handler middleware

    - Implement errorHandler function with support for all error types
    - Handle Zod validation errors and Prisma errors
    - _Requirements: 14.1_

  - [ ]\* 4.3 Write property test for structured error responses
    - **Property 37: Structured Error Responses**
    - **Validates: Requirements 14.1**

- [x] 5. Implement text extraction utilities

  - [x] 5.1 Create TextExtractor class with LangChain loaders

    - Implement extractFromPdf using PDFLoader
    - Implement extractFromDocx using DocxLoader
    - Implement extractFromTxt using TextLoader
    - Implement extractFromUrl using CheerioWebBaseLoader
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]\* 5.2 Write unit tests for text extraction

    - Test PDF extraction with sample file
    - Test DOCX extraction with sample file
    - Test TXT extraction with sample file
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]\* 5.3 Write property test for extraction failure handling
    - **Property 8: Extraction Failure Handling**
    - **Validates: Requirements 3.5**

- [x] 6. Implement text chunking utilities

  - [x] 6.1 Create TextChunker class with RecursiveCharacterTextSplitter

    - Configure chunk size to 1000 characters
    - Configure chunk overlap to 200 characters
    - Preserve metadata with each chunk
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]\* 6.2 Write property test for chunk size constraint

    - **Property 9: Chunk Size Constraint**
    - **Validates: Requirements 4.2**

  - [ ]\* 6.3 Write property test for chunk overlap preservation

    - **Property 10: Chunk Overlap Preservation**
    - **Validates: Requirements 4.3**

  - [ ]\* 6.4 Write property test for metadata preservation
    - **Property 11: Metadata Preservation**
    - **Validates: Requirements 4.4**

- [x] 7. Implement embedding service

  - [x] 7.1 Create EmbeddingService class with Google Generative AI Embeddings

    - Implement generateEmbedding for single text
    - Implement generateBatchEmbeddings for multiple texts
    - Support model configuration from environment
    - _Requirements: 5.1, 6.2, 15.3_

  - [ ]\* 7.2 Write property test for complete embedding generation

    - **Property 12: Complete Embedding Generation**
    - **Validates: Requirements 5.1**

  - [ ]\* 7.3 Write property test for embedding dimension consistency
    - **Property 18: Embedding Dimension Consistency**
    - **Validates: Requirements 6.2**

- [x] 8. Implement vector store service

  - [x] 8.1 Create VectorStore class with ChromaDB client

    - Implement createCollection for project-specific collections
    - Implement addDocuments to store chunks with embeddings
    - Implement similaritySearch with project filtering and top-K retrieval
    - Implement deleteCollection for project deletion
    - _Requirements: 5.2, 5.3, 7.1, 7.2_

  - [ ]\* 8.2 Write property test for vector storage round-trip

    - **Property 13: Vector Storage Round-Trip**
    - **Validates: Requirements 5.2**

  - [ ]\* 8.3 Write property test for collection isolation

    - **Property 14: Collection Isolation**
    - **Validates: Requirements 5.3**

  - [ ]\* 8.4 Write property test for project-filtered search

    - **Property 19: Project-Filtered Search**
    - **Validates: Requirements 7.1**

  - [ ]\* 8.5 Write property test for top-K retrieval

    - **Property 20: Top-K Retrieval**
    - **Validates: Requirements 7.2**

  - [ ]\* 8.6 Write property test for score-ordered results
    - **Property 22: Score-Ordered Results**
    - **Validates: Requirements 7.4**

- [ ] 9. Checkpoint - Ensure all core utilities tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement LLM service

  - [x] 10.1 Create LLMService class with Google Generative AI

    - Implement generateResponse with system and user prompts
    - Configure temperature ≤ 0.3
    - Support model configuration from environment
    - _Requirements: 10.4, 11.1, 15.1, 15.2_

  - [ ]\* 10.2 Write property test for temperature constraint

    - **Property 31: Temperature Constraint**
    - **Validates: Requirements 10.4**

  - [ ]\* 10.3 Write property test for verbatim LLM output
    - **Property 32: Verbatim LLM Output**
    - **Validates: Requirements 11.1**

- [ ] 11. Implement ProjectService

  - [x] 11.1 Create ProjectService class with Prisma client

    - Implement createProject to generate unique ID and store in database
    - Implement getProject to retrieve project with document count
    - Implement deleteProject to cascade delete from both databases
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]\* 11.2 Write property test for unique project identifiers

    - **Property 1: Unique Project Identifiers**
    - **Validates: Requirements 1.1**

  - [ ]\* 11.3 Write property test for complete project details

    - **Property 2: Complete Project Details**
    - **Validates: Requirements 1.2**

  - [ ]\* 11.4 Write property test for cascade deletion
    - **Property 3: Cascade Deletion**
    - **Validates: Requirements 1.3**

- [x] 12. Implement DocumentService

  - [x] 12.1 Create DocumentService class for document upload and validation

    - Implement uploadDocument with file size validation by type
    - Implement uploadUrl with URL format validation
    - Create database record with status "pending"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.3_

  - [ ]\* 12.2 Write property test for file size validation by type

    - **Property 5: File Size Validation by Type**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**

  - [ ]\* 12.3 Write property test for URL format validation

    - **Property 6: URL Format Validation**
    - **Validates: Requirements 2.4**

  - [ ]\* 12.4 Write property test for unsupported file type rejection

    - **Property 7: Unsupported File Type Rejection**
    - **Validates: Requirements 2.6**

  - [ ]\* 12.5 Write property test for initial document status

    - **Property 35: Initial Document Status**
    - **Validates: Requirements 12.3**

  - [x] 12.6 Implement processDocument for document processing pipeline

    - Extract text using TextExtractor
    - Chunk text using TextChunker
    - Generate embeddings using EmbeddingService
    - Store vectors using VectorStore
    - Update document status to "ready" or "failed"
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 12.4, 12.5_

  - [ ]\* 12.7 Write property test for successful processing status

    - **Property 15: Successful Processing Status**
    - **Validates: Requirements 5.4, 12.4**

  - [ ]\* 12.8 Write property test for failed processing status
    - **Property 16: Failed Processing Status**
    - **Validates: Requirements 5.5, 12.5**

- [x] 13. Implement ChatService

  - [x] 13.1 Create ChatService class for query processing

    - Implement processQuery with project validation
    - Generate query embedding
    - Perform similarity search
    - Check relevance threshold (0.75)
    - Assemble context if threshold met
    - Construct prompts with strict instructions
    - Invoke LLM
    - Return response with source count
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3_

  - [ ]\* 13.2 Write property test for project existence validation

    - **Property 17: Project Existence Validation**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]\* 13.3 Write property test for relevance threshold enforcement

    - **Property 23: Relevance Threshold Enforcement**
    - **Validates: Requirements 8.2, 8.4**

  - [ ]\* 13.4 Write property test for context assembly trigger

    - **Property 24: Context Assembly Trigger**
    - **Validates: Requirements 8.3**

  - [ ]\* 13.5 Write property test for ranked context concatenation

    - **Property 25: Ranked Context Concatenation**
    - **Validates: Requirements 9.1**

  - [ ]\* 13.6 Write property test for token limit enforcement

    - **Property 26: Token Limit Enforcement**
    - **Validates: Requirements 9.2**

  - [ ]\* 13.7 Write property test for truncation preserves ranking

    - **Property 27: Truncation Preserves Ranking**
    - **Validates: Requirements 9.3**

  - [ ]\* 13.8 Write property test for system prompt instruction

    - **Property 28: System Prompt Instruction**
    - **Validates: Requirements 10.1**

  - [ ]\* 13.9 Write property test for exact fallback instruction

    - **Property 29: Exact Fallback Instruction**
    - **Validates: Requirements 10.2**

  - [ ]\* 13.10 Write property test for complete user prompt

    - **Property 30: Complete User Prompt**
    - **Validates: Requirements 10.3**

  - [ ]\* 13.11 Write property test for source count accuracy

    - **Property 33: Source Count Accuracy**
    - **Validates: Requirements 11.2**

  - [ ]\* 13.12 Write property test for consistent response format

    - **Property 34: Consistent Response Format**
    - **Validates: Requirements 11.3**

  - [ ]\* 13.13 Write property test for project isolation
    - **Property 4: Project Isolation**
    - **Validates: Requirements 1.4**

- [ ] 14. Checkpoint - Ensure all service layer tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement Zod validation schemas

  - [x] 15.1 Create validation schemas for all API endpoints

    - CreateProjectSchema
    - UploadDocumentSchema
    - ChatRequestSchema
    - _Requirements: 13.6_

  - [ ]\* 15.2 Write property test for request payload validation
    - **Property 36: Request Payload Validation**
    - **Validates: Requirements 13.6**

- [x] 16. Implement POST /api/projects endpoint

  - [x] 16.1 Create API route handler for project creation

    - Validate request with Zod schema
    - Call ProjectService.createProject
    - Return 201 with project details
    - Handle errors with errorHandler
    - _Requirements: 13.1, 13.6_

  - [ ]\* 16.2 Write integration test for POST /api/projects
    - Test successful project creation returns 201
    - Test validation errors return 400
    - _Requirements: 13.1_

- [x] 17. Implement GET /api/projects/:id endpoint

  - [x] 17.1 Create API route handler for project retrieval

    - Extract project ID from URL
    - Call ProjectService.getProject
    - Return 200 with project details including document count
    - Handle not found errors with 404
    - _Requirements: 13.2_

  - [ ]\* 17.2 Write integration test for GET /api/projects/:id
    - Test successful retrieval returns 200
    - Test non-existent project returns 404
    - _Requirements: 13.2_

- [x] 18. Implement DELETE /api/projects/:id endpoint

  - [x] 18.1 Create API route handler for project deletion

    - Extract project ID from URL
    - Call ProjectService.deleteProject
    - Return 200 with success confirmation
    - Handle not found errors with 404
    - _Requirements: 13.3_

  - [ ]\* 18.2 Write integration test for DELETE /api/projects/:id
    - Test successful deletion returns 200
    - Test cascade deletion removes all documents
    - Test non-existent project returns 404
    - _Requirements: 13.3_

- [x] 19. Implement POST /api/documents/upload endpoint

  - [x] 19.1 Create API route handler for document upload

    - Parse multipart form data
    - Validate request with Zod schema
    - Call DocumentService.uploadDocument or uploadUrl
    - Trigger async processDocument
    - Return 201 with document details
    - Handle validation errors with 400
    - _Requirements: 13.4, 13.6_

  - [ ]\* 19.2 Write integration test for POST /api/documents/upload
    - Test successful file upload returns 201
    - Test successful URL upload returns 201
    - Test oversized file returns 400
    - Test unsupported file type returns 400
    - Test invalid URL returns 400
    - _Requirements: 13.4_

- [x] 20. Implement POST /api/chat endpoint

  - [x] 20.1 Create API route handler for chat queries

    - Validate request with Zod schema
    - Call ChatService.processQuery
    - Return 200 with answer and sourceCount
    - Handle not found errors with 404
    - Handle service unavailable errors with 503
    - _Requirements: 13.5, 13.6_

  - [ ]\* 20.2 Write integration test for POST /api/chat

    - Test successful query returns 200 with answer
    - Test query with high relevance returns LLM response
    - Test query with low relevance returns "I don't know"
    - Test non-existent project returns 404
    - _Requirements: 13.5_

  - [ ]\* 20.3 Write property test for database connection failure handling
    - **Property 38: Database Connection Failure Handling**
    - **Validates: Requirements 14.4, 14.5**

- [x] 21. Implement retry logic and circuit breaker

  - [ ] 21.1 Create withRetry utility function

    - Implement exponential backoff
    - Skip retry for validation and not found errors
    - _Requirements: 14.1_

  - [ ] 21.2 Create CircuitBreaker class

    - Implement state management (closed, open, half-open)
    - Apply to ChromaDB and LLM calls
    - _Requirements: 14.4, 14.5_

  - [ ]\* 21.3 Write unit tests for retry logic

    - Test successful retry after transient failure
    - Test no retry for validation errors
    - _Requirements: 14.1_

  - [ ]\* 21.4 Write unit tests for circuit breaker
    - Test circuit opens after threshold failures
    - Test circuit closes after successful call in half-open state
    - _Requirements: 14.4, 14.5_

- [x] 22. Implement model agnosticism support

  - [ ] 22.1 Add configuration support for local LLM endpoints

    - Extend LLMConfig to support local endpoints
    - Extend EmbeddingConfig to support local endpoints
    - Update LLMService to switch between Gemini and local
    - Update EmbeddingService to switch between Gemini and local
    - _Requirements: 15.2, 15.3_

  - [ ]\* 22.2 Write property test for embedding dimension compatibility
    - **Property 39: Embedding Dimension Compatibility**
    - **Validates: Requirements 15.4**

- [ ] 23. Final checkpoint - Run full test suite

  - Run all unit tests
  - Run all property-based tests with 100+ iterations
  - Run all integration tests
  - Verify test coverage meets 80% threshold
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Create README documentation

  - [ ] 24.1 Document environment variable setup

    - List all required environment variables
    - Provide example .env file
    - _Requirements: 15.1, 15.3, 15.5_

  - [ ] 24.2 Document API endpoints

    - Document request/response formats for all endpoints
    - Provide example curl commands
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 24.3 Document setup and deployment instructions
    - Database setup with Prisma migrations
    - ChromaDB setup
    - Running the development server
    - Running tests

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end API flows
- The implementation follows a bottom-up approach: infrastructure → utilities → services → API routes
- All code should use TypeScript with strict mode enabled
- Error handling should use the custom error classes defined in the design
- All external service calls should use retry logic and circuit breakers where appropriate
