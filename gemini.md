# Project Constitution - Intelligent Test Plan Generator

## Overview
A full-stack web application that automates test plan creation by integrating JIRA ticket data with LLM-powered analysis using customizable PDF templates.

---

## Data Schemas

### 1. Database Schema (SQLite)

#### Table: `settings`
```typescript
interface Settings {
  id: INTEGER PRIMARY KEY;
  
  // JIRA Configuration
  jira_base_url: TEXT;
  jira_username: TEXT;
  jira_api_token: TEXT; // Encrypted
  jira_connected: BOOLEAN DEFAULT false;
  
  // LLM Configuration
  llm_provider: TEXT; // "groq" | "ollama"
  
  // Groq Settings
  groq_api_key: TEXT; // Encrypted
  groq_model: TEXT; // "llama3-70b", "mixtral-8x7b", etc.
  groq_temperature: REAL; // 0.0 - 1.0
  
  // Ollama Settings
  ollama_base_url: TEXT; // default: "http://localhost:11434"
  ollama_model: TEXT;
  
  updated_at: TIMESTAMP;
}
```

#### Table: `templates`
```typescript
interface Template {
  id: INTEGER PRIMARY KEY AUTOINCREMENT;
  name: TEXT;
  filename: TEXT;
  filepath: TEXT;
  content: TEXT; // Extracted text from PDF
  is_default: BOOLEAN DEFAULT false;
  created_at: TIMESTAMP;
  updated_at: TIMESTAMP;
}
```

#### Table: `jira_tickets`
```typescript
interface JiraTicket {
  id: INTEGER PRIMARY KEY AUTOINCREMENT;
  ticket_key: TEXT UNIQUE; // e.g., "VWO-123"
  summary: TEXT;
  description: TEXT;
  priority: TEXT;
  status: TEXT;
  assignee: TEXT;
  labels: TEXT; // JSON array
  acceptance_criteria: TEXT;
  attachments: TEXT; // JSON array
  raw_data: TEXT; // Full JIRA response JSON
  fetched_at: TIMESTAMP;
}
```

#### Table: `test_plan_history`
```typescript
interface TestPlanHistory {
  id: INTEGER PRIMARY KEY AUTOINCREMENT;
  ticket_key: TEXT;
  ticket_id: INTEGER; // FK to jira_tickets
  template_id: INTEGER; // FK to templates
  llm_provider: TEXT;
  generated_content: TEXT; // Markdown
  created_at: TIMESTAMP;
}
```

---

### 2. API Request/Response Schemas

#### POST /api/settings/jira
**Request:**
```typescript
interface JiraSettingsRequest {
  baseUrl: string;
  username: string;
  apiToken: string;
}
```
**Response:**
```typescript
interface JiraSettingsResponse {
  success: boolean;
  message: string;
  connectionStatus: boolean;
}
```

#### POST /api/settings/llm
**Request:**
```typescript
interface LLMSettingsRequest {
  provider: "groq" | "ollama";
  // Groq specific
  groqApiKey?: string;
  groqModel?: string;
  groqTemperature?: number;
  // Ollama specific
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}
```

#### GET /api/jira/fetch?ticketId=VWO-123
**Response:**
```typescript
interface JiraTicketResponse {
  key: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  assignee: string;
  labels: string[];
  acceptanceCriteria: string;
  attachments: Attachment[];
}

interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}
```

#### POST /api/testplan/generate
**Request:**
```typescript
interface GenerateTestPlanRequest {
  ticketId: string;
  templateId?: number; // null = use default
  provider: "groq" | "ollama";
}
```
**Response (Streaming):**
```typescript
// Server-Sent Events (SSE)
interface GenerationStreamEvent {
  type: "progress" | "content" | "complete" | "error";
  data: string;
  progress?: number; // 0-100
}
```

---

### 3. Frontend TypeScript Types

```typescript
// Settings Types
interface AppSettings {
  jira: JiraConfig;
  llm: LLMConfig;
}

interface JiraConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  isConnected: boolean;
}

interface LLMConfig {
  provider: "groq" | "ollama";
  groq: GroqConfig;
  ollama: OllamaConfig;
}

interface GroqConfig {
  apiKey: string;
  model: string;
  temperature: number;
  availableModels: string[];
}

interface OllamaConfig {
  baseUrl: string;
  model: string;
  availableModels: string[];
}

// Template Types
interface Template {
  id: number;
  name: string;
  filename: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
}

// JIRA Types
interface JiraTicket {
  key: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  assignee: string;
  labels: string[];
  acceptanceCriteria: string;
  attachments: Attachment[];
  fetchedAt: string;
}

// Test Plan Types
interface TestPlan {
  id: number;
  ticketKey: string;
  ticket: JiraTicket;
  template: Template;
  content: string;
  provider: string;
  createdAt: string;
}

// UI State Types
type LoadingState = "idle" | "loading" | "success" | "error";

interface GenerationProgress {
  stage: "fetching" | "analyzing" | "generating" | "complete";
  message: string;
  percent: number;
}
```

---

## Behavioral Rules

### 1. Security Rules
- API keys must NEVER be stored in localStorage
- Use OS-specific secure storage (keytar) or encrypted config files
- CORS restricted to localhost only
- All inputs validated (JIRA IDs: regex `[A-Z]+-\d+`)
- PDF uploads limited to <5MB, scanned for malicious content

### 2. LLM Provider Rules
- Default provider: Groq (cloud)
- Fallback to Ollama if configured and Groq fails
- Timeout: 30s for Groq, 120s for Ollama
- Retry logic: 3 attempts with exponential backoff
- Temperature default: 0.7 for balanced creativity

### 3. Template Rules
- Must have a default fallback template
- PDF text extraction preserves structure (paragraphs, sections)
- Only one template can be marked as default
- Template content cached in database for performance

### 4. JIRA Integration Rules
- Cache fetched tickets in database
- Recent tickets: last 5 fetched, ordered by fetch time
- Re-fetch updates existing ticket record
- Connection must be tested before allowing fetches

### 5. Generation Rules
- System prompt: "You are a QA Engineer. Generate a comprehensive test plan based on the provided JIRA ticket and following the structure of the template below."
- Context must include: ticket data + template structure
- Output must be valid Markdown
- Streaming updates every 100ms if supported

---

## Architectural Invariants

### INV-1: Backend Security
All API keys and sensitive configuration must be stored server-side only. Frontend never has direct access to API keys.

### INV-2: Separation of Concerns
- Frontend: UI rendering, user interactions, API calls to backend
- Backend: External API integration (JIRA, LLM), data persistence, security

### INV-3: Provider Abstraction
LLM provider interface must be abstracted to allow easy addition of new providers without changing business logic.

### INV-4: Single Source of Truth
- JIRA ticket data: Database (cached from JIRA API)
- Settings: Database (encrypted sensitive fields)
- Templates: Database (content cached, files stored on disk)

### INV-5: Error Handling Strategy
All errors must be:
- Caught at the source
- Logged with context
- Transformed to user-friendly messages
- Never expose sensitive information

---

## API Contracts

### Backend Routes Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/settings/jira | Save JIRA config | - |
| GET | /api/settings/jira | Get JIRA status | - |
| POST | /api/settings/jira/test | Test JIRA connection | - |
| POST | /api/settings/llm | Save LLM config | - |
| GET | /api/settings/llm | Get LLM config | - |
| GET | /api/settings/llm/models | List Ollama models | - |
| POST | /api/jira/fetch | Fetch ticket by ID | - |
| GET | /api/jira/recent | Get recent tickets | - |
| POST | /api/templates/upload | Upload PDF template | multipart |
| GET | /api/templates | List templates | - |
| GET | /api/templates/:id | Get template by ID | - |
| DELETE | /api/templates/:id | Delete template | - |
| POST | /api/testplan/generate | Generate test plan | SSE |
| GET | /api/testplan/history | Get generation history | - |
| GET | /api/testplan/history/:id | Get specific test plan | - |

---

## Technology Stack Decision

**Backend Choice: Node.js (Express)**

Rationale:
1. Unified JavaScript/TypeScript stack (frontend + backend)
2. Better ecosystem for PDF processing (pdf-parse)
3. Native streaming support for LLM responses
4. Easier deployment (single npm ecosystem)
5. Keytar library available for secure credential storage

---

*Document Version: 1.0*
*Last Updated: 2026-02-14*
