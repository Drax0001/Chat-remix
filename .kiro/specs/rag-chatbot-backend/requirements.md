# Requirements Document

## Introduction

This document specifies the requirements for a RAG (Retrieval-Augmented Generation) based knowledge-restricted chatbot backend system. The system enables users to upload documents and create AI chatbots that answer questions exclusively based on the uploaded content, preventing hallucinations and ensuring factual responses grounded in user-provided data.

## Glossary

- **RAG_System**: The Retrieval-Augmented Generation backend that orchestrates document ingestion, vector storage, retrieval, and response generation
- **Project**: A logical container that groups related documents and maintains isolated knowledge boundaries
- **Document**: Any uploaded file (PDF, DOCX, TXT) or URL that serves as a knowledge source
- **Chunk**: A segmented portion of a document optimized for embedding and retrieval
- **Embedding_Model**: The neural network that converts text into vector representations
- **Vector_Database**: ChromaDB instance that stores and retrieves document chunk embeddings
- **Metadata_Database**: PostgreSQL database managed by Prisma that stores project and document metadata
- **LLM**: Large Language Model (Gemini initially) that generates responses based on retrieved context
- **Similarity_Score**: Numerical measure (0-1) indicating relevance between query and retrieved chunks
- **Relevance_Threshold**: Minimum similarity score (0.75) required to provide an answer

## Requirements

### Requirement 1: Project Management

**User Story:** As a user, I want to create and manage isolated projects, so that I can organize different knowledge domains separately (e.g., one project for a supermarket inventory, another for company policies).

#### Acceptance Criteria

1. WHEN a user creates a new project with a name, THE RAG_System SHALL generate a unique project identifier and store it in the Metadata_Database
2. WHEN a user requests project details, THE RAG_System SHALL return the project name, creation timestamp, and document count
3. WHEN a user deletes a project, THE RAG_System SHALL remove all associated documents from both Vector_Database and Metadata_Database
4. THE RAG_System SHALL enforce project-level data isolation such that queries to one project never retrieve data from another project

### Requirement 2: Document Upload and Validation

**User Story:** As a user, I want to upload various document types and URLs, so that I can build a comprehensive knowledge base from multiple sources.

#### Acceptance Criteria

1. WHEN a user uploads a PDF file, THE RAG_System SHALL accept files up to 10MB in size
2. WHEN a user uploads a DOCX file, THE RAG_System SHALL accept files up to 10MB in size
3. WHEN a user uploads a TXT file, THE RAG_System SHALL accept files up to 5MB in size
4. WHEN a user provides a URL, THE RAG_System SHALL validate that it is a properly formatted HTTP/HTTPS URL
5. IF an uploaded file exceeds size limits, THEN THE RAG_System SHALL reject the upload and return a descriptive error message
6. IF an uploaded file has an unsupported format, THEN THE RAG_System SHALL reject the upload and return a descriptive error message

### Requirement 3: Document Processing and Text Extraction

**User Story:** As a system, I want to extract text content from various document formats, so that I can prepare content for embedding generation.

#### Acceptance Criteria

1. WHEN a PDF document is uploaded, THE RAG_System SHALL extract text using LangChain PDFLoader
2. WHEN a DOCX document is uploaded, THE RAG_System SHALL extract text using LangChain DocxLoader
3. WHEN a TXT document is uploaded, THE RAG_System SHALL extract text using LangChain TextLoader
4. WHEN a URL is provided, THE RAG_System SHALL extract text content using CheerioWebBaseLoader
5. IF text extraction fails for any document, THEN THE RAG_System SHALL mark the document status as failed and store the error message

### Requirement 4: Text Chunking and Segmentation

**User Story:** As a system, I want to split extracted text into optimal chunks, so that I can generate meaningful embeddings and enable precise retrieval.

#### Acceptance Criteria

1. WHEN text is extracted from a document, THE RAG_System SHALL split it into chunks using RecursiveCharacterTextSplitter
2. THE RAG_System SHALL configure chunk size to 1000 characters
3. THE RAG_System SHALL configure chunk overlap to 200 characters
4. WHEN chunking is complete, THE RAG_System SHALL preserve document metadata (source filename, page numbers if available) with each chunk

### Requirement 5: Embedding Generation and Vector Storage

**User Story:** As a system, I want to generate embeddings for document chunks and store them in a vector database, so that I can perform semantic similarity searches.

#### Acceptance Criteria

1. WHEN chunks are created, THE RAG_System SHALL generate embeddings using the Embedding_Model for each chunk
2. THE RAG_System SHALL store each embedding vector in the Vector_Database with its associated chunk text
3. THE RAG_System SHALL store embeddings in a project-specific collection to enforce isolation
4. WHEN all chunks are successfully embedded, THE RAG_System SHALL update the document status to ready in the Metadata_Database
5. IF any chunk embedding fails, THEN THE RAG_System SHALL mark the document status as failed

### Requirement 6: Query Processing and Embedding

**User Story:** As a user, I want to ask questions about my uploaded documents, so that I can retrieve information from my knowledge base.

#### Acceptance Criteria

1. WHEN a user submits a query with a project identifier and message, THE RAG_System SHALL validate that the project exists
2. WHEN a valid query is received, THE RAG_System SHALL generate an embedding for the user message using the same Embedding_Model used for documents
3. IF the project does not exist, THEN THE RAG_System SHALL return an error message indicating invalid project

### Requirement 7: Semantic Similarity Search

**User Story:** As a system, I want to retrieve the most relevant document chunks for a user query, so that I can provide contextually appropriate information to the LLM.

#### Acceptance Criteria

1. WHEN a query embedding is generated, THE RAG_System SHALL perform similarity search in the Vector_Database filtered by project collection
2. THE RAG_System SHALL retrieve the top 5 most similar chunks based on cosine similarity
3. THE RAG_System SHALL return each chunk with its text content and similarity score
4. THE RAG_System SHALL rank results in descending order by similarity score

### Requirement 8: Relevance Threshold and Anti-Hallucination

**User Story:** As a system, I want to enforce a relevance threshold, so that I prevent the LLM from generating answers when no relevant information exists in the knowledge base.

#### Acceptance Criteria

1. WHEN similarity search results are returned, THE RAG_System SHALL identify the highest similarity score
2. IF the highest similarity score is less than 0.75, THEN THE RAG_System SHALL return a response with answer "I don't know" and sourceCount 0
3. IF the highest similarity score is greater than or equal to 0.75, THEN THE RAG_System SHALL proceed with context assembly
4. THE RAG_System SHALL NOT invoke the LLM when the relevance threshold is not met

### Requirement 9: Context Assembly and Token Management

**User Story:** As a system, I want to assemble retrieved chunks into a coherent context, so that I can provide the LLM with relevant information while respecting token limits.

#### Acceptance Criteria

1. WHEN relevant chunks are retrieved, THE RAG_System SHALL concatenate them in ranked order by similarity score
2. THE RAG_System SHALL ensure the total assembled context does not exceed model-safe token limits
3. IF concatenating all chunks would exceed token limits, THEN THE RAG_System SHALL truncate to include only the highest-ranked chunks that fit

### Requirement 10: Prompt Construction and LLM Invocation

**User Story:** As a system, I want to construct strict prompts that enforce knowledge restriction, so that the LLM only answers based on provided context.

#### Acceptance Criteria

1. WHEN context is assembled, THE RAG_System SHALL construct a system prompt that instructs the LLM to answer only using provided context
2. THE RAG_System SHALL include the exact instruction: "If the answer is not explicitly present, respond exactly: I don't know"
3. THE RAG_System SHALL construct a user prompt containing the assembled context and the user question
4. WHEN invoking the LLM, THE RAG_System SHALL set temperature to a maximum of 0.3
5. THE RAG_System SHALL NOT enable memory, tools, or agent capabilities during LLM invocation

### Requirement 11: Response Generation and Delivery

**User Story:** As a user, I want to receive factual answers based on my uploaded documents, so that I can trust the chatbot responses are grounded in my knowledge base.

#### Acceptance Criteria

1. WHEN the LLM generates a response, THE RAG_System SHALL return the model output verbatim without post-processing
2. THE RAG_System SHALL include the count of source chunks used in the response
3. THE RAG_System SHALL return responses in a consistent JSON format with answer and sourceCount fields
4. THE RAG_System SHALL NOT modify or "improve" the LLM output to maintain factual integrity

### Requirement 12: Database Schema and Metadata Management

**User Story:** As a system, I want to maintain structured metadata about projects and documents, so that I can track processing status and enable efficient queries.

#### Acceptance Criteria

1. THE Metadata_Database SHALL store a Project table with fields: id, name, createdAt
2. THE Metadata_Database SHALL store a Document table with fields: id, projectId, filename, fileType, status, uploadedAt, errorMessage
3. WHEN a document is uploaded, THE RAG_System SHALL create a database record with status pending
4. WHEN processing completes successfully, THE RAG_System SHALL update status to ready
5. WHEN processing fails, THE RAG_System SHALL update status to failed and store the error message

### Requirement 13: API Endpoint Structure

**User Story:** As a frontend developer, I want well-defined API endpoints, so that I can integrate the backend with the user interface.

#### Acceptance Criteria

1. THE RAG_System SHALL expose a POST endpoint at /api/projects for creating projects
2. THE RAG_System SHALL expose a GET endpoint at /api/projects/:id for retrieving project details
3. THE RAG_System SHALL expose a DELETE endpoint at /api/projects/:id for deleting projects
4. THE RAG_System SHALL expose a POST endpoint at /api/documents/upload for uploading documents
5. THE RAG_System SHALL expose a POST endpoint at /api/chat for processing user queries
6. THE RAG_System SHALL validate request payloads using Zod schemas for all endpoints

### Requirement 14: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can diagnose issues and maintain system reliability.

#### Acceptance Criteria

1. WHEN any API endpoint encounters an error, THE RAG_System SHALL return a structured error response with status code and message
2. THE RAG_System SHALL log all document processing errors with document ID and error details
3. THE RAG_System SHALL log all LLM invocation errors with project ID and query details
4. IF the Vector_Database connection fails, THEN THE RAG_System SHALL return a 503 Service Unavailable error
5. IF the Metadata_Database connection fails, THEN THE RAG_System SHALL return a 503 Service Unavailable error

### Requirement 15: Model Agnosticism and Configuration

**User Story:** As a system administrator, I want to configure which LLM and embedding models to use, so that I can switch between Gemini and local models without code changes.

#### Acceptance Criteria

1. THE RAG_System SHALL read LLM configuration from environment variables
2. THE RAG_System SHALL support both Google Gemini and local LLM endpoints through configuration
3. THE RAG_System SHALL read embedding model configuration from environment variables
4. WHEN switching models, THE RAG_System SHALL maintain compatibility by using the same embedding dimensions
5. THE RAG_System SHALL validate that required API keys or endpoints are configured before processing requests
