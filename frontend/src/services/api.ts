/**
 * API Service
 * 
 * HTTP client for communicating with the backend API.
 * Uses Axios with request/response interceptors.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  ApiResponse,
  JiraConfig,
  LLMConfig,
  JiraSettingsFormData,
  LLMSettingsFormData,
  JiraTicket,
  Template,
  TestPlanHistory,
} from '../types';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject({
      success: false,
      error: {
        message: error.message || 'Network error',
        code: 'NETWORK_ERROR',
        status: 0,
      },
    });
  }
);

// ============================================
// Settings API
// ============================================

export const settingsApi = {
  // JIRA Settings
  getJiraSettings: () =>
    api.get<ApiResponse<JiraConfig>>('/settings/jira').then(r => r.data),

  saveJiraSettings: (data: JiraSettingsFormData) =>
    api.post<ApiResponse<void>>('/settings/jira', data).then(r => r.data),

  testJiraConnection: () =>
    api.post<ApiResponse<{ connectionStatus: boolean; user?: string; message: string }>>(
      '/settings/jira/test'
    ).then(r => r.data),

  // LLM Settings
  getLLMSettings: () =>
    api.get<ApiResponse<LLMConfig>>('/settings/llm').then(r => r.data),

  saveLLMSettings: (data: LLMSettingsFormData) =>
    api.post<ApiResponse<void>>('/settings/llm', data).then(r => r.data),

  testLLMConnection: (provider: 'groq' | 'ollama') =>
    api.post<ApiResponse<{ connectionStatus: boolean; message: string; models?: string[] }>>(
      '/settings/llm/test',
      { provider }
    ).then(r => r.data),

  getOllamaModels: () =>
    api.get<ApiResponse<string[]>>('/settings/llm/models').then(r => r.data),
};

// ============================================
// JIRA API
// ============================================

export const jiraApi = {
  fetchTicket: (ticketId: string) =>
    api.get<ApiResponse<JiraTicket>>(`/jira/fetch/${ticketId}`).then(r => r.data),

  getTicket: (ticketId: string) =>
    api.get<ApiResponse<JiraTicket>>(`/jira/ticket/${ticketId}`).then(r => r.data),

  getRecentTickets: (limit = 5) =>
    api.get<ApiResponse<JiraTicket[]>>(`/jira/recent?limit=${limit}`).then(r => r.data),

  searchTickets: (query: string) =>
    api.get<ApiResponse<JiraTicket[]>>(`/jira/search?q=${encodeURIComponent(query)}`).then(r => r.data),

  deleteTicket: (ticketId: string) =>
    api.delete<ApiResponse<void>>(`/jira/ticket/${ticketId}`).then(r => r.data),
};

// ============================================
// Templates API
// ============================================

export const templatesApi = {
  getAllTemplates: () =>
    api.get<ApiResponse<Template[]>>('/templates').then(r => r.data),

  getTemplate: (id: number) =>
    api.get<ApiResponse<Template>>(`/templates/${id}`).then(r => r.data),

  getDefaultTemplate: () =>
    api.get<ApiResponse<Template>>('/templates/default').then(r => r.data),

  uploadTemplate: (file: File, name?: string) => {
    const formData = new FormData();
    formData.append('template', file);
    if (name) {
      formData.append('name', name);
    }
    return api.post<ApiResponse<Template>>('/templates/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  updateTemplate: (id: number, data: { name?: string; isDefault?: boolean }) =>
    api.put<ApiResponse<Template>>(`/templates/${id}`, data).then(r => r.data),

  setAsDefault: (id: number) =>
    api.post<ApiResponse<Template>>(`/templates/${id}/default`).then(r => r.data),

  deleteTemplate: (id: number) =>
    api.delete<ApiResponse<void>>(`/templates/${id}`).then(r => r.data),

  downloadTemplate: (id: number) =>
    api.get<Blob>(`/templates/${id}/download`, { responseType: 'blob' }),
};

// ============================================
// Test Plan API
// ============================================

export const testplanApi = {
  // SSE Streaming generation
  generateStream: (
    ticketId: string,
    provider: 'groq' | 'ollama',
    templateId?: number,
    onMessage?: (event: { type: string; data?: string; progress?: number }) => void,
    onError?: (error: string) => void,
    onComplete?: () => void
  ) => {
    const eventSource = new EventSource(
      `${api.defaults.baseURL}/testplan/generate?ticketId=${ticketId}&provider=${provider}${templateId ? `&templateId=${templateId}` : ''}`
    );

    // For POST requests with SSE, we need to use fetch directly
    const controller = new AbortController();
    
    fetch(`${api.defaults.baseURL}/testplan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, provider, templateId }),
      signal: controller.signal,
    }).then(async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onMessage?.(data);

              if (data.type === 'complete' || data.type === 'error' || data.type === 'done') {
                reader.cancel();
                if (data.type === 'complete') {
                  onComplete?.();
                } else if (data.type === 'error') {
                  onError?.(data.data);
                }
                return;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    }).catch((error) => {
      onError?.(error.message);
    });

    return controller;
  },

  // Synchronous generation
  generateSync: (ticketId: string, provider: 'groq' | 'ollama', templateId?: number) =>
    api.post<ApiResponse<{ content: string; ticketId: string; provider: string }>>(
      '/testplan/generate-sync',
      { ticketId, provider, templateId }
    ).then(r => r.data),

  getHistory: (limit = 20) =>
    api.get<ApiResponse<TestPlanHistory[]>>(`/testplan/history?limit=${limit}`).then(r => r.data),

  getTestPlan: (id: number) =>
    api.get<ApiResponse<TestPlanHistory>>(`/testplan/history/${id}`).then(r => r.data),

  deleteTestPlan: (id: number) =>
    api.delete<ApiResponse<void>>(`/testplan/history/${id}`).then(r => r.data),

  exportTestPlan: (id: number) =>
    api.get<Blob>(`/testplan/history/${id}/export`, { responseType: 'blob' }),
};

export default api;
