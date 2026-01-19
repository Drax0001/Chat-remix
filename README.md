# RAG Chatbot Backend

A Retrieval-Augmented Generation (RAG) based knowledge-restricted chatbot backend that enables users to upload documents and create AI chatbots that answer questions exclusively based on the uploaded content.

## Overview

This backend system provides a complete RAG pipeline that:

- Accepts document uploads (PDF, DOCX, TXT) and URLs
- Processes documents into optimized text chunks
- Generates embeddings for semantic similarity search
- Stores vectors in ChromaDB with project-level isolation
- Performs relevance-filtered queries with anti-hallucination safeguards
- Invokes LLMs with strict knowledge boundaries
- Returns factual responses based only on uploaded content

## Features

- **Document Processing**: Support for PDF, DOCX, TXT files and web URLs
- **Project Isolation**: Each project maintains separate knowledge boundaries
- **Semantic Search**: Cosine similarity search with relevance thresholding
- **Anti-Hallucination**: Strict prompts prevent LLM from generating unsupported answers
- **Model Agnosticism**: Support for both Google Gemini and local LLM endpoints
- **Resilience**: Retry logic and circuit breakers for external service reliability
- **REST API**: Complete API for frontend integration

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   REST API      │    │   Services      │    │   External      │
│                 │    │                 │    │   Services      │
│ • Project Mgmt  │◄──►│ • ProjectService│    │                 │
│ • Document      │    │ • DocumentService│    │ • ChromaDB     │
│   Upload        │    │ • ChatService   │    │ • Google Gemini │
│ • Chat Queries  │    │ • LLMService    │    │ • Local LLMs    │
│                 │    │ • EmbeddingSvc  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Vector Store  │    │   Resilience    │
│                 │    │                 │    │                 │
│ • PostgreSQL    │    │ • ChromaDB      │    │ • Retry Logic   │
│ • Prisma ORM    │    │ • Collections   │    │ • Circuit       │
│ • Metadata      │    │ • Embeddings    │    │   Breakers      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- **Node.js** 18+ and npm/yarn
- **PostgreSQL** database
- **ChromaDB** vector database
- **Google Gemini API key** (or local LLM endpoint)

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd rag-chatbot-backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up databases**

   ```bash
   # PostgreSQL - create database
   createdb rag_chatbot

   # ChromaDB - start server (if running locally)
   docker run -p 8000:8000 chromadb/chroma
   ```

4. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

## Environment Variables

### Required

| Variable         | Description                             | Example                                             |
| ---------------- | --------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string            | `postgresql://user:pass@localhost:5432/rag_chatbot` |
| `GOOGLE_API_KEY` | Google Gemini API key (if using Gemini) | `AIzaSy...`                                         |

### Database Configuration

| Variable      | Description   | Default     |
| ------------- | ------------- | ----------- |
| `CHROMA_HOST` | ChromaDB host | `localhost` |
| `CHROMA_PORT` | ChromaDB port | `8000`      |

### Processing Configuration

| Variable               | Description                    | Default |
| ---------------------- | ------------------------------ | ------- |
| `MAX_FILE_SIZE_MB`     | Maximum file size in MB        | `10`    |
| `RELEVANCE_THRESHOLD`  | Minimum similarity score (0-1) | `0.75`  |
| `LLM_TEMPERATURE`      | LLM temperature (max 0.3)      | `0.3`   |
| `LLM_MAX_TOKENS`       | Maximum LLM response tokens    | `1024`  |
| `EMBEDDING_DIMENSIONS` | Embedding vector dimensions    | `768`   |

### Model Providers

#### Google Gemini (Default)

| Variable               | Description          | Default         |
| ---------------------- | -------------------- | --------------- |
| `LLM_PROVIDER`         | LLM provider         | `gemini`        |
| `LLM_MODEL_NAME`       | Gemini model name    | `gemini-pro`    |
| `EMBEDDING_PROVIDER`   | Embedding provider   | `gemini`        |
| `EMBEDDING_MODEL_NAME` | Embedding model name | `embedding-001` |

#### Local LLM Endpoints

| Variable             | Description                  | Example                                      |
| -------------------- | ---------------------------- | -------------------------------------------- |
| `LLM_PROVIDER`       | Set to `local`               | `local`                                      |
| `LLM_ENDPOINT`       | Local LLM API endpoint       | `http://localhost:11434/v1/chat/completions` |
| `EMBEDDING_PROVIDER` | Set to `local`               | `local`                                      |
| `EMBEDDING_ENDPOINT` | Local embedding API endpoint | `http://localhost:11434/v1/embeddings`       |

### Example .env file

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rag_chatbot"

# Google Gemini (default)
GOOGLE_API_KEY="your-gemini-api-key-here"

# ChromaDB
CHROMA_HOST="localhost"
CHROMA_PORT="8000"

# Processing
MAX_FILE_SIZE_MB="10"
RELEVANCE_THRESHOLD="0.75"
LLM_TEMPERATURE="0.3"
LLM_MAX_TOKENS="1024"
EMBEDDING_DIMENSIONS="768"

# Model Configuration (Gemini default)
LLM_PROVIDER="gemini"
LLM_MODEL_NAME="gemini-pro"
EMBEDDING_PROVIDER="gemini"
EMBEDDING_MODEL_NAME="embedding-001"

# For local models (uncomment to use)
# LLM_PROVIDER="local"
# LLM_ENDPOINT="http://localhost:11434/v1/chat/completions"
# EMBEDDING_PROVIDER="local"
# EMBEDDING_ENDPOINT="http://localhost:11434/v1/embeddings"
```

## API Documentation

### Projects

#### Create Project

```http
POST /api/projects
Content-Type: application/json

{
  "name": "My Knowledge Base"
}
```

**Response (201):**

```json
{
  "id": "uuid-string",
  "name": "My Knowledge Base",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get Project

```http
GET /api/projects/{id}
```

**Response (200):**

```json
{
  "id": "uuid-string",
  "name": "My Knowledge Base",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "documentCount": 5
}
```

#### Delete Project

```http
DELETE /api/projects/{id}
```

**Response (200):**

```json
{
  "message": "Project deleted successfully"
}
```

### Documents

#### Upload Document

```http
POST /api/documents/upload
Content-Type: multipart/form-data
```

**Form Data:**

- `projectId`: UUID of the project
- `file`: File to upload (PDF, DOCX, TXT) OR
- `url`: URL to process

**Response (201):**

```json
{
  "id": "uuid-string",
  "projectId": "uuid-string",
  "filename": "document.pdf",
  "fileType": "pdf",
  "status": "pending",
  "uploadedAt": "2024-01-01T00:00:00.000Z"
}
```

### Chat

#### Process Query

```http
POST /api/chat
Content-Type: application/json

{
  "projectId": "uuid-string",
  "message": "What are the main features of this product?"
}
```

**Response (200):**

```json
{
  "answer": "Based on the uploaded documents, the main features include...",
  "sourceCount": 3
}
```

**Low Relevance Response:**

```json
{
  "answer": "I don't know",
  "sourceCount": 0
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional validation details
  }
}
```

### Common Error Codes

| Code                  | HTTP Status | Description               |
| --------------------- | ----------- | ------------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid request data      |
| `NOT_FOUND`           | 404         | Resource not found        |
| `SERVICE_UNAVAILABLE` | 503         | External service failure  |
| `DATABASE_ERROR`      | 500         | Database operation failed |
| `VECTOR_STORE_ERROR`  | 500         | ChromaDB operation failed |
| `LLM_ERROR`           | 500         | LLM invocation failed     |

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/lib/__tests__/text-chunker.test.ts
```

### Database Operations

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration-name

# Reset database
npx prisma migrate reset

# View database
npx prisma studio
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Deployment

### Production Environment

1. **Set environment variables** for production databases and API keys
2. **Run database migrations** on production database
3. **Build the application**
   ```bash
   npm run build
   ```
4. **Start the production server**
   ```bash
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Resilience Features

### Retry Logic

- **Exponential backoff** for transient failures
- **Configurable attempts** and delays
- **Smart error filtering** (no retry for validation errors)

### Circuit Breakers

- **Failure threshold detection** (5 failures trigger open state)
- **Automatic recovery** testing (half-open state)
- **Timeout-based reset** (60 second reset timeout)

### Applied To

- **ChromaDB operations** (vector storage and retrieval)
- **LLM API calls** (response generation)
- **Embedding generation** (both single and batch)

## Model Agnosticism

The system supports multiple model providers without code changes:

### Google Gemini (Recommended)

- Production-ready with enterprise support
- Consistent API and high reliability
- Automatic retry and circuit breaker protection

### Local LLMs

- **Ollama**: Run models like Llama, Mistral locally
- **Custom endpoints**: Any OpenAI-compatible API
- **Privacy**: Keep data on-premise
- **Cost**: No API charges after initial setup

### Switching Providers

Change these environment variables to switch providers:

```bash
# For local Ollama
LLM_PROVIDER=local
LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
EMBEDDING_PROVIDER=local
EMBEDDING_ENDPOINT=http://localhost:11434/v1/embeddings
```

## File Size Limits

| File Type | Maximum Size            |
| --------- | ----------------------- |
| PDF       | 10 MB                   |
| DOCX      | 10 MB                   |
| TXT       | 5 MB                    |
| URL       | No limit (web scraping) |

## Security Considerations

- **API Key Protection**: Never commit keys to version control
- **Input Validation**: All inputs validated with Zod schemas
- **Error Handling**: No sensitive information in error messages
- **Rate Limiting**: Consider implementing on production deployment
- **HTTPS**: Always use HTTPS in production

## Troubleshooting

### Common Issues

**ChromaDB Connection Failed**

```
Error: Vector store connection failed
```

- Ensure ChromaDB is running on configured host/port
- Check network connectivity
- Verify ChromaDB version compatibility

**LLM Service Unavailable**

```
Error: Circuit breaker is OPEN - service unavailable
```

- Check API key validity
- Verify network connectivity to LLM provider
- Wait for automatic recovery or restart service

**Document Processing Failed**

```
Error: Failed to generate embeddings
```

- Check embedding service configuration
- Verify document format is supported
- Check file size limits

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:

- Check the troubleshooting section
- Review existing GitHub issues
- Create a new issue with detailed information
