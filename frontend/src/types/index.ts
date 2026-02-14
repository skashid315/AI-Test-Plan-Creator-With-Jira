// ============================================
// Frontend TypeScript Types
// ============================================

// API Response Types
// ------------------

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    code: string;
    status: number;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}

// Settings Types
// --------------

export interface JiraConfig {
  baseUrl: string;
  username: string;
  isConnected: boolean;
  hasCredentials: boolean;
}

export interface GroqConfig {
  model: string;
  temperature: number;
  hasApiKey: boolean;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export interface LLMConfig {
  provider: 'groq' | 'ollama';
  groq: GroqConfig;
  ollama: OllamaConfig;
}

export interface Settings {
  jira: JiraConfig;
  llm: LLMConfig;
}

// JIRA Ticket Types
// -----------------

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export interface JiraTicket {
  key: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  assignee: string;
  labels: string[];
  acceptanceCriteria: string;
  attachments: Attachment[];
  cached?: boolean;
}

// Template Types
// --------------

export interface Template {
  id: number;
  name: string;
  filename: string;
  filepath: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
}

// Test Plan Types
// ---------------

export interface TestPlanHistory {
  id: number;
  ticketKey: string;
  ticketId: number;
  templateId: number;
  llmProvider: string;
  generatedContent: string;
  createdAt: string;
  ticketSummary?: string;
}

export interface GenerationProgress {
  type: 'progress' | 'content' | 'complete' | 'error' | 'done';
  data?: string;
  progress?: number;
}

// UI State Types
// --------------

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Form Types
// ----------

export interface JiraSettingsFormData {
  baseUrl: string;
  username: string;
  apiToken: string;
}

export interface LLMSettingsFormData {
  provider: 'groq' | 'ollama';
  groqApiKey: string;
  groqModel: string;
  groqTemperature: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

// Navigation Types
// ----------------

export type Page = 'dashboard' | 'settings' | 'history';

export interface NavItem {
  label: string;
  icon: string;
  page: Page;
}
