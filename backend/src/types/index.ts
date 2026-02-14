// ============================================
// Backend TypeScript Types
// ============================================

// Database Models
// ---------------

export interface Settings {
  id: number;
  
  // JIRA Configuration
  jira_base_url: string;
  jira_username: string;
  jira_api_token: string; // Encrypted
  jira_connected: boolean;
  
  // LLM Configuration
  llm_provider: 'groq' | 'ollama';
  
  // Groq Settings
  groq_api_key: string; // Encrypted
  groq_model: string;
  groq_temperature: number;
  
  // Ollama Settings
  ollama_base_url: string;
  ollama_model: string;
  
  updated_at: string;
}

export interface Template {
  id: number;
  name: string;
  filename: string;
  filepath: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface JiraTicket {
  id: number;
  ticket_key: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  assignee: string;
  labels: string;
  acceptance_criteria: string;
  attachments: string;
  raw_data: string;
  fetched_at: string;
}

export interface TestPlanHistory {
  id: number;
  ticket_key: string;
  ticket_id: number;
  template_id: number;
  llm_provider: string;
  generated_content: string;
  created_at: string;
}

// API Request/Response Types
// --------------------------

export interface JiraSettingsRequest {
  baseUrl: string;
  username: string;
  apiToken: string;
}

export interface JiraSettingsResponse {
  success: boolean;
  message: string;
  connectionStatus: boolean;
}

export interface LLMSettingsRequest {
  provider: 'groq' | 'ollama';
  groqApiKey?: string;
  groqModel?: string;
  groqTemperature?: number;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export interface JiraTicketResponse {
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

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export interface GenerateTestPlanRequest {
  ticketId: string;
  templateId?: number;
  provider: 'groq' | 'ollama';
}

export interface GenerationStreamEvent {
  type: 'progress' | 'content' | 'complete' | 'error';
  data: string;
  progress?: number;
}

// LLM Provider Types
// ------------------

export interface LLMProvider {
  generateTestPlan(context: TestPlanContext): AsyncGenerator<string>;
  testConnection(): Promise<boolean>;
  listModels(): Promise<string[]>;
}

export interface TestPlanContext {
  ticket: JiraTicketResponse;
  template: string;
  temperature?: number;
}

export interface GroqConfig {
  apiKey: string;
  model: string;
  temperature: number;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

// Application Types
// -----------------

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  databasePath: string;
  templatesDir: string;
}

export interface ApiError {
  status: number;
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

// Database Row Types (for better-sqlite3)
// ---------------------------------------

export interface SettingsRow {
  id: number;
  jira_base_url: string;
  jira_username: string;
  jira_api_token: string;
  jira_connected: number;
  llm_provider: string;
  groq_api_key: string;
  groq_model: string;
  groq_temperature: number;
  ollama_base_url: string;
  ollama_model: string;
  updated_at: string;
}

export interface TemplateRow {
  id: number;
  name: string;
  filename: string;
  filepath: string;
  content: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface JiraTicketRow {
  id: number;
  ticket_key: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  assignee: string;
  labels: string;
  acceptance_criteria: string;
  attachments: string;
  raw_data: string;
  fetched_at: string;
}
